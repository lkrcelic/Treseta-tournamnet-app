// The nights already played: every past night of every league, written in bulk the way the app leaves a finished
// night behind (published tables, lineups, two matches each with their hands, the bye's 5 : 0, Tu smo on nights with a
// start time). Pairing is a plain Swiss by the standings so far, with no pair twice in a night; the app's own Novo
// kolo pairing is time-budgeted and so not repeatable, and the tests exercise it on tonight's nights anyway.
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {nightMoment, type Ctx} from "../context";
import {BYE_MATCH_POINTS} from "@/app/_lib/game/scoring";
import {edgeOf, LEAGUE_RULES, lineups, playMatch, strengths, TableWriter} from "../play";
import type {BuiltLeague} from "./leagues";
import type {People} from "./people";

type Standing = {points: number; diff: number; met: Set<number>};

// how many teams come to a night (production: ~73%)
const ATTENDANCE = 0.75;
const MINUTES_PER_KOLO = 45;

export type PlayedNights = {lastRoundNumber: number; strength: Map<number, number>};

export function swissRound(rng: Ctx["rng"], teamIds: number[], table: Map<number, Standing>, metTonight: Set<string>) {
  const order = rng
    .shuffle(teamIds)
    .sort((a, b) => table.get(b)!.points - table.get(a)!.points || table.get(b)!.diff - table.get(a)!.diff);
  const pairs: [number, number][] = [];
  const left = [...order];
  let bye: number | null = null;
  if (left.length % 2 === 1) bye = left.pop()!; // the lowest team sits out against the bye
  while (left.length > 0) {
    const a = left.shift()!;
    const key = (b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
    let idx = left.findIndex((b) => !metTonight.has(key(b)) && !table.get(a)!.met.has(b));
    if (idx < 0) idx = left.findIndex((b) => !metTonight.has(key(b)));
    if (idx < 0) idx = 0;
    const b = left.splice(idx, 1)[0];
    metTonight.add(key(b));
    pairs.push([a, b]);
  }
  return {pairs, bye};
}

export async function playLeagueHistory(
  ctx: Ctx,
  people: People,
  built: BuiltLeague,
  writer: TableWriter,
  nights: Date[],
): Promise<PlayedNights> {
  const {prisma} = ctx;
  const rng = ctx.rng.fork(`history-${built.spec.key}`);
  const leagueId = built.league.league_id;
  const teamIds = built.teams.map((t) => t.team_id);
  const strength = strengths(rng, teamIds);
  const table = new Map<number, Standing>(teamIds.map((id) => [id, {points: 0, diff: 0, met: new Set<number>()}]));
  const smokingTables = new Set(built.spec.key === "current" ? [1, 2] : built.spec.key === "past2" ? [1] : []);
  const smokers = new Map<number, number>();
  const activeSmokers = new Set(people.players.filter((p) => p.smoker && p.active).map((p) => p.id));
  for (const id of teamIds) smokers.set(id, (people.rosters.get(id) ?? []).filter((p) => activeSmokers.has(p)).length);
  if (smokingTables.size > 0) {
    await prisma.league.update({where: {league_id: leagueId}, data: {smoking_tables: Array.from(smokingTables)}});
  }

  let roundNumber = 0;
  const arrivals: {league_id: number; night: Date; team_id: number; arrived_at: Date; arrived_by: number | null; by_admin: boolean}[] = [];

  for (const night of nights) {
    // the player's team comes to every night of the current league, so its history is full
    const present = teamIds.filter((id) => id === people.playerTeam.team_id || rng.chance(ATTENDANCE));
    if (built.spec.startTime) {
      for (const id of present) {
        const roster = people.rosters.get(id) ?? [];
        const byAdmin = roster.length === 0 || rng.chance(0.3);
        arrivals.push({
          league_id: leagueId,
          night,
          team_id: id,
          arrived_at: nightMoment(night, `19:${String(rng.int(0, 29)).padStart(2, "0")}`),
          arrived_by: byAdmin ? null : rng.pick(roster),
          by_admin: byAdmin,
        });
      }
    }
    const metTonight = new Set<string>();
    for (let kolo = 0; kolo < built.spec.roundsPerNight; kolo++) {
      roundNumber++;
      const published = new Date(nightMoment(night, "19:35").getTime() + kolo * MINUTES_PER_KOLO * 60_000);
      const {pairs, bye} = swissRound(rng, present, table, metTonight);
      // smokers first to the smoking tables, as Novo kolo seats them
      const seated = [...pairs].sort((x, y) => {
        const sx = smokers.get(x[0])! + smokers.get(x[1])!;
        const sy = smokers.get(y[0])! + smokers.get(y[1])!;
        return smokingTables.size > 0 ? sy - sx : 0;
      });
      for (const [i, [t1, t2]] of Array.from(seated.entries())) {
        const roundId = writer.nextRoundId();
        const edge = edgeOf(strength, t1, t2);
        const m1 = playMatch(rng, edge, LEAGUE_RULES);
        const m2 = playMatch(rng, edge, LEAGUE_RULES);
        // a table's wins are its matches' winners: "s ovim dosta" can win with fewer points
        const wins1 = Number(m1.winner === 1) + Number(m2.winner === 1);
        const start = new Date(published.getTime() + rng.int(1, 6) * 60_000);
        const mid = new Date(start.getTime() + rng.int(14, 22) * 60_000);
        const end = new Date(mid.getTime() + rng.int(14, 22) * 60_000);
        writer.rounds.push({
          id: roundId,
          round_number: roundNumber,
          round_date: night,
          team1_id: t1,
          team2_id: t2,
          team1_wins: wins1,
          team2_wins: 2 - wins1,
          open: false,
          active: false,
          table_number: i + 1,
          smoking_table: smokingTables.has(i + 1),
          team1_smokers: smokers.get(t1)!,
          team2_smokers: smokers.get(t2)!,
          status: "PUBLISHED",
          published_at: published,
          matches_per_round: 2,
        });
        writer.leagueRounds.push({league_id: leagueId, round_id: roundId});
        const [players1, players2] = lineups(rng, people.activeRosters.get(t1) ?? [], people.activeRosters.get(t2) ?? []);
        for (const [teamId, ids] of [[t1, players1], [t2, players2]] as const) {
          for (const playerId of ids) writer.roundPlayers.push({round_id: roundId, player_id: playerId, team_id: teamId});
        }
        writer.addMatch(roundId, night, m1, start, mid);
        writer.addMatch(roundId, night, m2, mid, end);
        const d = m1.score1 - m1.score2 + m2.score1 - m2.score2;
        const s1 = table.get(t1)!;
        const s2 = table.get(t2)!;
        s1.points += wins1 === 2 ? 2 : wins1 === 1 ? 1 : 0;
        s2.points += wins1 === 0 ? 2 : wins1 === 1 ? 1 : 0;
        s1.diff += d;
        s2.diff -= d;
        s1.met.add(t2);
        s2.met.add(t1);
      }
      if (bye !== null) {
        const roundId = writer.nextRoundId();
        writer.rounds.push({
          id: roundId,
          round_number: roundNumber,
          round_date: night,
          team1_id: bye,
          team2_id: BYE_TEAM_ID,
          team1_wins: 2,
          team2_wins: 0,
          open: false,
          active: false,
          table_number: seated.length + 1,
          smoking_table: false,
          team1_smokers: smokers.get(bye)!,
          team2_smokers: 0,
          status: "PUBLISHED",
          published_at: published,
          matches_per_round: 2,
        });
        writer.leagueRounds.push({league_id: leagueId, round_id: roundId});
        writer.addScoreOnly(roundId, night, BYE_MATCH_POINTS, 0, null);
        writer.addScoreOnly(roundId, night, BYE_MATCH_POINTS, 0, null);
        table.get(bye)!.points += 2;
        table.get(bye)!.diff += 602;
        table.get(bye)!.met.add(BYE_TEAM_ID);
      }
    }
  }
  if (arrivals.length > 0) await prisma.leagueArrival.createMany({data: arrivals});
  return {lastRoundNumber: roundNumber, strength};
}

// the nights of a league before tonight
export function pastNights(built: BuiltLeague, tonight: Date): Date[] {
  return built.spec.nights.filter((n) => n < tonight);
}
