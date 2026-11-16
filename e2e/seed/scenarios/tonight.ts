// Tonight, made the way an admin and the phones make it, through the app's services:
// - the current league's live night: teams switched on (Tu smo), two Kolos created by Novo kolo's insertRoundBatch,
//   approved and published (Skica → Objavi), the first played out, the second in every state a table can be in, and
//   a third waiting as Skica A;
// - small leagues of their own for the tests that change data, so no test steps on another's tables.
import type {Team} from "@prisma/client";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import type {SeatedPair} from "@/app/_lib/matching/smokingTables";
import {setArrivals} from "@/app/_lib/service/league/arrival";
import {insertRoundBatch} from "@/app/_lib/service/round/insertPairRounds";
import {approveNight, publishNight} from "@/app/_lib/service/round/publication";
import {recalcTeamScores, replayRatings} from "@/app/_lib/service/admin/recalc";
import {addDays, type Ctx} from "../context";
import {playLiveTable, usernames, type LivePlan} from "../live";
import {createIds, edgeOf, strengths, syncSequences, TableWriter} from "../play";
import {createLeague, type BuiltLeague, type LeagueSpec} from "./leagues";
import {playLeagueHistory, swissRound} from "./history";
import type {People} from "./people";

type Standing = {points: number; diff: number; met: Set<number>};

async function standingsOf(ctx: Ctx, leagueId: number, teamIds: number[]): Promise<Map<number, Standing>> {
  const scores = await ctx.prisma.teamScore.findMany({where: {league_id: leagueId}});
  const met = await ctx.prisma.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}},
    select: {team1_id: true, team2_id: true},
  });
  const table = new Map<number, Standing>(teamIds.map((id) => [id, {points: 0, diff: 0, met: new Set<number>()}]));
  for (const s of scores) {
    const row = table.get(s.team_id);
    if (row) Object.assign(row, {points: s.score, diff: s.point_difference});
  }
  for (const r of met) {
    table.get(r.team1_id)?.met.add(r.team2_id);
    table.get(r.team2_id)?.met.add(r.team1_id);
  }
  return table;
}

// Novo kolo's batch for tonight: Swiss pairs, smokers first to the smoking tables, the bye last
async function batch(
  ctx: Ctx,
  built: BuiltLeague,
  present: number[],
  kolos: number,
  smokingTables: number[],
  smokers: Map<number, number>,
): Promise<void> {
  const rng = ctx.rng.fork(`batch-${built.spec.key}-${kolos}`);
  const table = await standingsOf(ctx, built.league.league_id, present);
  const names = new Map(built.teams.map((t) => [t.team_id, t.team_name]));
  const team = (id: number) => ({
    id,
    name: id === BYE_TEAM_ID ? "bye" : names.get(id)!,
    score: table.get(id)?.points ?? 0,
    point_difference: table.get(id)?.diff ?? 0,
    played_against: Array.from(table.get(id)?.met ?? []),
  });
  const metTonight = new Set<string>();
  const rounds: SeatedPair[][] = [];
  for (let k = 0; k < kolos; k++) {
    const {pairs, bye} = swissRound(rng, present, table, metTonight);
    const seated = [...pairs].sort((x, y) =>
      smokingTables.length > 0 ? (smokers.get(y[0]) ?? 0) + (smokers.get(y[1]) ?? 0) - (smokers.get(x[0]) ?? 0) - (smokers.get(x[1]) ?? 0) : 0,
    );
    const round: SeatedPair[] = seated.map(([a, b], i) => ({
      teamOne: team(a),
      teamTwo: team(b),
      table: i + 1,
      smoking: smokingTables.includes(i + 1),
    }));
    if (bye !== null) round.push({teamOne: team(bye), teamTwo: team(BYE_TEAM_ID), table: round.length + 1, smoking: false});
    rounds.push(round);
  }
  await insertRoundBatch(rounds, built.league.league_id, {smokers, tables: smokingTables.length > 0 ? smokingTables : undefined});
}

async function tonightTables(ctx: Ctx, leagueId: number, roundNumber?: number) {
  return ctx.prisma.round.findMany({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_date: ctx.tonight, ...(roundNumber ? {round_number: roundNumber} : {})},
    orderBy: [{round_number: "asc"}, {table_number: "asc"}],
  });
}

function smokersOf(people: People, teams: Team[]): Map<number, number> {
  const smoking = new Set(people.players.filter((p) => p.smoker && p.active).map((p) => p.id));
  return new Map(teams.map((t) => [t.team_id, (people.rosters.get(t.team_id) ?? []).filter((id) => smoking.has(id)).length]));
}

export async function seedCurrentNight(ctx: Ctx, people: People, current: BuiltLeague, strength: Map<number, number>) {
  const {prisma} = ctx;
  const rng = ctx.rng.fork("tonight-current");
  const leagueId = current.league.league_id;
  const teamIds = current.teams.map((t) => t.team_id);
  const present = teamIds.filter((id) => id === people.playerTeam.team_id || rng.chance(0.78));

  // Tu smo: the admin's switch for most, so Novo kolo pairs the teams that are here; a few say they left
  await setArrivals(leagueId, present, true, ctx.now);
  const absent = teamIds.filter((id) => !present.includes(id));
  const leftEarly = rng.sample(absent, 2);
  await setArrivals(leagueId, leftEarly, true, ctx.now);
  await setArrivals(leagueId, leftEarly, false, ctx.now);

  const smokers = smokersOf(people, current.teams);
  await batch(ctx, current, present, 2, [1, 2], smokers);
  await approveNight(leagueId, ctx.tonightString);
  await publishNight(leagueId, ctx.tonightString);

  const all = await tonightTables(ctx, leagueId);
  const [first, second] = Array.from(new Set(all.map((r) => r.round_number!)));
  const real = (n: number) => all.filter((r) => r.round_number === n && r.team2_id !== BYE_TEAM_ID);
  const play = (r: (typeof all)[number], plan: LivePlan) =>
    playLiveTable(
      ctx,
      rng,
      {roundId: r.id, team1: r.team1_id, team2: r.team2_id, matchesPerRound: 2, declarations: true, edge: edgeOf(strength, r.team1_id, r.team2_id)},
      people.activeRosters,
      plan,
    );

  const started = Date.now();
  for (const r of real(first)) await play(r, {finished: 2});
  // the second Kolo: some tables done, some in the second match, some in the first, one waiting for Tko igra
  const secondTables = real(second);
  for (const [i, r] of Array.from(secondTables.entries())) {
    const mine = r.team1_id === people.playerTeam.team_id || r.team2_id === people.playerTeam.team_id;
    const plan: LivePlan = mine
      ? {finished: 0, handsInOpenMatch: 3}
      : i % 5 === 0
        ? {finished: 0, untouched: true}
        : i % 5 === 1
          ? {finished: 2}
          : i % 5 === 2
            ? {finished: 1, handsInOpenMatch: 4}
            : {finished: 0, handsInOpenMatch: rng.int(1, 6)};
    const live = await play(r, plan);
    if (mine) {
      ctx.catalog.tables.playerTonight = {
        roundId: r.id,
        matchId: live.openMatchId ?? undefined,
        note: "Igračeva ekipa večeras u ligi: prvi meč u tijeku, 3 igre",
        team1: await usernames(ctx, people.rosters, r.team1_id),
        team2: await usernames(ctx, people.rosters, r.team2_id),
      };
    }
  }
  // Skica A for the third Kolo, waiting for the admin's Objavi
  await batch(ctx, current, present, 1, [1, 2], smokers);
  ctx.catalog.leagues.current.tonight = ctx.tonightString;
  ctx.log(`tonight (current league): ${all.length} tables in 2 Kolos + a Skica, played in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

// A small league of its own for a test that changes data: some past nights for its standings, tonight on the calendar
async function scenarioLeague(
  ctx: Ctx,
  people: People,
  key: string,
  name: string,
  teams: Team[],
  startTime: string | null,
): Promise<{built: BuiltLeague; strength: Map<number, number>}> {
  const nights = [-21, -14, -7, 0].map((d) => addDays(ctx.tonight, d));
  const spec: LeagueSpec = {
    key,
    name,
    season: "E2E",
    teams: teams.length,
    nights,
    datedLeague: true,
    roundsPerNight: 2,
    startTime,
    gatheringTime: null,
    location: null,
  };
  const built = await createLeague(ctx, spec, teams);
  const writer = new TableWriter(await idsAfterExisting(ctx));
  const played = await playLeagueHistory(ctx, people, built, writer, nights.slice(0, 3));
  await writer.flush(ctx);
  await syncSequences(ctx);
  await ctx.prisma.$transaction(
    async (tx) => {
      await recalcTeamScores(tx, built.league.league_id, teams.map((t) => t.team_id));
      await replayRatings(tx);
    },
    {timeout: 120_000},
  );
  return {built, strength: played.strength};
}

async function idsAfterExisting(ctx: Ctx) {
  const ids = createIds();
  const max = async (sql: string) => Number((await ctx.prisma.$queryRawUnsafe<{m: number | null}[]>(sql))[0].m ?? 0);
  ids.round = await max(`SELECT MAX(id) m FROM "Round"`);
  ids.match = await max(`SELECT MAX(id) m FROM "Match"`);
  ids.result = await max(`SELECT MAX(result_id) m FROM "Result"`);
  return ids;
}

// The leagues the tests change. Each takes teams nobody else uses tonight.
export async function seedScenarioLeagues(ctx: Ctx, people: People, freeTeams: Team[], current: BuiltLeague) {
  const rng = ctx.rng.fork("scenario-leagues");
  const pool = rng.shuffle(freeTeams.filter((t) => (people.activeRosters.get(t.team_id) ?? []).length >= 2));
  // nobody plays two tables tonight: no player of these leagues is in the current league or in another of them
  const used = new Set(current.teams.flatMap((t) => people.rosters.get(t.team_id) ?? []));
  // `three`: how many of the n teams have three active players (Tko igra then asks which two play)
  const take = (n: number, three = 0) => {
    const out: Team[] = [];
    const active = (team: Team) => (people.activeRosters.get(team.team_id) ?? []).length;
    const order = [...pool.filter((t) => active(t) >= 3), ...pool.filter((t) => active(t) < 3)];
    for (const team of three ? order : [...pool]) {
      if (out.length === n) break;
      if (three && out.length < three && active(team) < 3) throw new Error(`no free team with three active players for a scenario league`);
      if (three && out.length >= three && active(team) >= 3) continue;
      const ids = people.rosters.get(team.team_id) ?? [];
      if (ids.some((id) => used.has(id))) continue;
      ids.forEach((id) => used.add(id));
      pool.splice(pool.indexOf(team), 1);
      out.push(team);
    }
    if (out.length < n) throw new Error(`only ${out.length} of ${n} free teams for a scenario league`);
    return out;
  };
  const accounts = async (teamId: number) => usernames(ctx, people.rosters, teamId);

  // Novo kolo → Skica → Objavi, by the admin; no start time, so no arrival: every active team plays
  const newRoundTeams = take(8, 1);
  const newRound = await scenarioLeague(ctx, people, "newRound", "E2E · Novo kolo", newRoundTeams, null);
  ctx.catalog.leagues.newRound.tonight = ctx.tonightString;

  // Tu smo, by a player: 20:00 start, half the teams already here
  const arrivalTeams = take(6);
  const arrival = await scenarioLeague(ctx, people, "arrival", "E2E · Tu smo", arrivalTeams, "20:00");
  await setArrivals(arrival.built.league.league_id, arrivalTeams.slice(0, 3).map((t) => t.team_id), true, ctx.now);
  ctx.catalog.leagues.arrival.tonight = ctx.tonightString;
  ctx.catalog.teams.arrivalNotHere = {id: arrivalTeams[4].team_id, name: arrivalTeams[4].team_name};

  // the scorepad: one published Kolo tonight, a table for each test
  const scorepadTeams = take(12);
  const scorepad = await scenarioLeague(ctx, people, "scorepad", "E2E · Scorepad", scorepadTeams, null);
  const leagueId = scorepad.built.league.league_id;
  await batch(ctx, scorepad.built, scorepadTeams.map((t) => t.team_id), 1, [], new Map());
  await approveNight(leagueId, ctx.tonightString);
  await publishNight(leagueId, ctx.tonightString);
  const tables = await tonightTables(ctx, leagueId);
  const purposes: [string, string, LivePlan][] = [
    ["handEntry", "Objavljen stol bez postave: Tko igra pa Upiši igru", {finished: 0, untouched: true}],
    ["correction", "Prvi meč u tijeku s 4 igre: ispravak spremljene igre", {finished: 0, handsInOpenMatch: 4}],
    ["finishMatch", "Ekipa je prešla 41 i vodi, čeka Završi meč", {finished: 0, toThreshold: true}],
    ["twoPhones", "Prvi meč u tijeku s 2 igre: ista igra s dva telefona", {finished: 0, handsInOpenMatch: 2}],
    ["timeLimit", "Prvi meč u tijeku s 3 igre: test pomakne ends_at", {finished: 0, handsInOpenMatch: 3}],
    ["adminEdit", "Odigran stol (2 meča): adminov ispravak vraća meč u igru", {finished: 2}],
  ];
  for (const [i, r] of Array.from(tables.filter((t) => t.team2_id !== BYE_TEAM_ID).entries())) {
    const [key, note, plan] = purposes[i];
    const live = await playLiveTable(
      ctx,
      rng,
      {roundId: r.id, team1: r.team1_id, team2: r.team2_id, matchesPerRound: 2, declarations: true, edge: edgeOf(scorepad.strength, r.team1_id, r.team2_id)},
      people.activeRosters,
      plan,
    );
    ctx.catalog.tables[key] = {roundId: r.id, matchId: live.openMatchId ?? undefined, note, team1: await accounts(r.team1_id), team2: await accounts(r.team2_id)};
  }
  ctx.catalog.leagues.scorepad.tonight = ctx.tonightString;

  // Each scenario team has a player who opens Početna without the birth-date or "Pušiš li?" sheet, so a test can log
  // that team in on Početna: its first active player finishes onboarding (the generated ones are like production,
  // ~60% with a birth date, ~45% answered)
  const firstActive = [...newRoundTeams, ...arrivalTeams, ...scorepadTeams].map((t) => (people.activeRosters.get(t.team_id) ?? [])[0]).filter((id) => id != null);
  await ctx.prisma.player.updateMany({where: {id: {in: firstActive}, birth_date: null}, data: {birth_date: new Date("1986-05-14")}});
  await ctx.prisma.player.updateMany({where: {id: {in: firstActive}, smoker_answered: false}, data: {smoker_answered: true, smoker: false}});
  ctx.log(`scenario leagues: newRound, arrival, scorepad (${tables.length} tables)`);
  return pool;
}

export {strengths};
