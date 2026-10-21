// What the pairing by average age (DECISIONS #64) does on real data: the players' ages as entered, every team's
// average, and the next round planned with and without the ages. Reads only, with the database in DATABASE_URL:
//   DATABASE_URL="postgresql://…" npm run ages:report                   (the league being played now)
//   DATABASE_URL="postgresql://…" npm run ages:report -- --league 3 --rounds 3 --window 8
import {prisma} from "@/app/_lib/prisma";
import {leagueNight} from "@/app/_lib/dates";
import {activeLeagueId} from "@/app/_lib/service/league/leagues";
import {getLeagueTeamsWithScores} from "@/app/_lib/helpers/query/leagueScores";
import {teamAverageAges} from "@/app/_lib/service/team/ages";
import {ageInYears, DEFAULT_AGE} from "@/app/_lib/matching/teamAges";
import {ageGap, generateMultipleRoundPairings, RoundsPlan, Team} from "@/app/_lib/matching/multipleRoundMatching";
import {isByeTeam} from "@/app/_lib/bye";

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const one = (n: number) => n.toFixed(1);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

(async () => {
  const today = leagueNight();
  const host = (process.env.DATABASE_URL ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "") || "(DATABASE_URL from .env)";
  console.log(`database: ${host}, night ${today.toISOString().slice(0, 10)}`);

  // 1. the players' ages as entered
  const players = await prisma.player.findMany({where: {active: true}, select: {birth_date: true}});
  const entered = players.filter((p) => p.birth_date).map((p) => ageInYears(p.birth_date!, today));
  console.log(`\nactive players: ${players.length}, with a birth date: ${entered.length}, without: ${players.length - entered.length}`);
  if (entered.length) {
    const avg = entered.reduce((s, a) => s + a, 0) / entered.length;
    console.log(`ages entered: average ${one(avg)}, median ${one(median(entered))}, youngest ${one(Math.min(...entered))}, oldest ${one(Math.max(...entered))}`);
    console.log(`a player without a birth date counts as ${DEFAULT_AGE} (${one(DEFAULT_AGE - avg)} from the average)`);
    const buckets = new Map<string, number>();
    entered.forEach((a) => {
      const from = Math.floor(a / 10) * 10;
      buckets.set(`${from}-${from + 9}`, (buckets.get(`${from}-${from + 9}`) ?? 0) + 1);
    });
    console.table(Array.from(buckets, ([years, count]) => ({years, players: count})).sort((a, b) => a.years.localeCompare(b.years)));
  }

  // 2. every active team of the league, with its average age
  const leagueId = arg("league", (await activeLeagueId()) ?? NaN);
  if (!Number.isFinite(leagueId)) throw new Error("no league: pass --league N");
  const active = new Set(
    (await prisma.leagueTeam.findMany({where: {league_id: leagueId, active: true}, select: {team_id: true}})).map((t) => t.team_id)
  );
  const ages = await teamAverageAges(Array.from(active), prisma, today);
  const rosters = await prisma.teamPlayer.findMany({
    where: {team_id: {in: Array.from(active)}, player: {active: true}},
    select: {team_id: true, player: {select: {birth_date: true}}},
  });
  const teams: Team[] = (await getLeagueTeamsWithScores(leagueId))
    .filter((t) => active.has(t.id))
    .map((t) => ({...t, average_age: ages.get(t.id) ?? null}));
  console.log(`\nleague ${leagueId}: ${teams.length} active teams`);
  console.table(
    teams.map((t) => {
      const roster = rosters.filter((r) => r.team_id === t.id);
      return {
        team: t.name,
        points: Number(t.score),
        players: roster.length,
        "no birth date": roster.filter((r) => !r.player.birth_date).length,
        "average age": t.average_age == null ? "—" : one(t.average_age),
      };
    })
  );

  // 3. the next rounds planned with the ages and without them
  const options = {windowSize: arg("window", 8), numberOfRounds: arg("rounds", 3)};
  const withAges = generateMultipleRoundPairings(teams, options);
  const withoutAges = generateMultipleRoundPairings(
    teams.map((t) => ({...t, average_age: null})),
    options
  );
  const summary = (plan: RoundsPlan) => {
    const real = plan.rounds.flat().filter((p) => !isByeTeam(p.teamOne.id) && !isByeTeam(p.teamTwo.id));
    const meetings = real.reduce((s, p) => s + p.teamOne.played_against.filter((id) => id === p.teamTwo.id).length ** 2, 0);
    const gaps = real.map((p) => {
      const a = ages.get(p.teamOne.id);
      const b = ages.get(p.teamTwo.id);
      return a != null && b != null ? Math.abs(a - b) : null;
    }).filter((g): g is number => g != null);
    return {
      "earlier meetings²": meetings,
      "repeats tonight": plan.repeats.length,
      "average age gap": one(gaps.reduce((s, g) => s + g, 0) / Math.max(1, gaps.length)),
      "largest age gap": one(Math.max(0, ...gaps)),
    };
  };
  console.log(`\nthe next ${options.numberOfRounds} rounds, window ${options.windowSize}:`);
  console.table({"without ages": summary(withoutAges), "with ages": summary(withAges)});

  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  withAges.rounds.forEach((round, r) => {
    const before = new Set(withoutAges.rounds[r].map((p) => key(p.teamOne.id, p.teamTwo.id)));
    const changed = round.filter((p) => !before.has(key(p.teamOne.id, p.teamTwo.id))).length;
    console.log(`\nround ${r + 1}: ${changed} of ${round.length} tables differ from the pairing without ages`);
    console.table(
      round.map((p, i) => ({
        table: i + 1,
        home: `${p.teamOne.name} (${p.teamOne.average_age == null ? "—" : one(p.teamOne.average_age)})`,
        away: isByeTeam(p.teamTwo.id) ? "slobodna runda" : `${p.teamTwo.name} (${p.teamTwo.average_age == null ? "—" : one(p.teamTwo.average_age)})`,
        "gap counted": isByeTeam(p.teamTwo.id) ? "" : ageGap(p.teamOne, p.teamTwo),
        new: before.has(key(p.teamOne.id, p.teamTwo.id)) ? "" : "*",
      }))
    );
  });
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
