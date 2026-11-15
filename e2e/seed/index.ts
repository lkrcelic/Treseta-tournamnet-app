// The E2E world: `npm run seed:e2e` empties the database DATABASE_URL points at and builds the whole world again,
// the same one for the same E2E_SEED on the same day. It is built for the real "now": the app's services stamp the
// real time (publishing, the no-show answer, a match's clock), and so does the server the tests then run against, so
// a pretend "now" could only make a world that disagrees with both.
// It refuses any database that isn't on this machine or in the compose stack, so it can never empty Neon.
import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {recalcTeamScores, replayRatings} from "@/app/_lib/service/admin/recalc";
import {createCtx, type Ctx} from "./context";
import {createIds, syncSequences, TableWriter} from "./play";
import {seedBans} from "./scenarios/bans";
import {seedBurza} from "./scenarios/burza";
import {pastNights, playLeagueHistory} from "./scenarios/history";
import {type BuiltLeague, createLeague, leagueSpecs, pickLeagueTeams} from "./scenarios/leagues";
import {seedPeople} from "./scenarios/people";
import {seedPlaces} from "./scenarios/places";
import {seedSponsors} from "./scenarios/sponsors";
import {seedCurrentNight, seedScenarioLeagues} from "./scenarios/tonight";
import {playTournamentHistory, seedTodayTournaments} from "./scenarios/tournamentPlay";
import {seedUpcomingTournaments, teamPool} from "./scenarios/tournaments";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "db"]);

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`seed:e2e empties the database, and ${host} is not a local one. Refusing.`);
  }
}

async function resetDatabase(ctx: Ctx) {
  const tables = await ctx.prisma.$queryRaw<{tablename: string}[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await ctx.prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  assertLocalDatabase();
  const seed = Number(process.env.E2E_SEED ?? 20261114);
  const now = new Date();
  const ctx = createCtx(seed, now);
  // the app's own random choices (Kolo 1's draw) follow the seed too, so the whole world repeats
  Math.random = ctx.rng.fork("math-random").next;
  const started = Date.now();
  const lap = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
  ctx.log(`seed:e2e · seed ${seed} · now ${now.toISOString()} · tonight ${ctx.tonightString}`);

  await resetDatabase(ctx);
  await seedPlaces(ctx);
  const people = await seedPeople(ctx);

  const leagues: Record<string, BuiltLeague> = {};
  for (const spec of leagueSpecs(ctx)) {
    leagues[spec.key] = await createLeague(ctx, spec, pickLeagueTeams(ctx, people, spec));
  }
  const current = leagues.current;

  // 1. history in bulk: the nights already played and the finished tournaments, then the standings and the ratings
  // the way the app computes them
  const writer = new TableWriter(createIds());
  const strength = new Map<string, Map<number, number>>();
  for (const built of Object.values(leagues)) {
    const played = await playLeagueHistory(ctx, people, built, writer, pastNights(built, ctx.tonight));
    strength.set(built.spec.key, played.strength);
    ctx.log(`history ${built.spec.key}: ${await writer.flush(ctx)}`);
  }
  await playTournamentHistory(ctx, people, await teamPool(ctx, people), writer);
  ctx.log(`history tournaments: ${await writer.flush(ctx)}`);
  await syncSequences(ctx);
  await ctx.prisma.$transaction(
    async (tx) => {
      for (const built of Object.values(leagues)) {
        await recalcTeamScores(tx, built.league.league_id, built.teams.map((t) => t.team_id));
      }
      await replayRatings(tx);
    },
    {timeout: 300_000},
  );
  ctx.log(`standings and ratings replayed · ${lap()}`);

  // 2. what admins set up: bans
  const inCurrent = new Set(current.teams.map((t) => t.team_id));
  const reserved = new Set(people.teams.slice(-2).map((t) => t.team_id));
  const outsideCurrent = people.teams.filter((t) => !inCurrent.has(t.team_id) && !reserved.has(t.team_id));
  await seedBans(ctx, people, outsideCurrent);
  const pool = await teamPool(ctx, people);

  // 3. tonight, through the app's services
  await seedCurrentNight(ctx, people, current, strength.get("current")!);
  const banned = new Set(
    (await ctx.prisma.signupBan.findMany({where: {lifted_at: null, team_id: {not: null}}, select: {team_id: true}})).map((b) => b.team_id),
  );
  await seedScenarioLeagues(ctx, people, outsideCurrent.filter((t) => !banned.has(t.team_id)), current);
  ctx.log(`tonight done · ${lap()}`);

  // 4. tournaments of today and to come
  const busyTonight = await ctx.prisma.team.findMany({
    where: {OR: [{roundsAsTeam1: {some: {round_date: ctx.tonight}}}, {leagueTeams: {some: {league_id: current.league.league_id}}}]},
  });
  const scenarioTeams = await ctx.prisma.team.findMany({
    where: {leagueTeams: {some: {league: {season: "E2E"}}}},
  });
  await seedTodayTournaments(ctx, people, pool, [...busyTonight, ...scenarioTeams]);
  await seedUpcomingTournaments(ctx, people, pool);
  ctx.log(`tournaments done · ${lap()}`);

  // 5. the rest of the app
  await seedSponsors(ctx, current.league.league_id);
  await seedBurza(ctx, people, current, leagues.past2);

  // the suite (e2e/local/app.sh) gives each section its own manifest folder
  const outDir = process.env.E2E_SEED_OUT ?? join(__dirname, "out");
  mkdirSync(outDir, {recursive: true});
  const manifest = {seed, now: now.toISOString(), tonight: ctx.tonightString, catalog: ctx.catalog};
  writeFileSync(join(outDir, "seed-manifest.json"), JSON.stringify(manifest, null, 2));
  ctx.log(`done in ${lap()} → ${join(outDir, "seed-manifest.json")}`);
  await ctx.prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
