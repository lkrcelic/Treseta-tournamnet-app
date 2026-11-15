// Hands and matches as they are played at a Treseta table, scored by the app's own rules (game/scoring.ts): a hand is
// 11 points between the teams (now and then Kaput, 11 : 0), zvanja of 3 and 4 on about a third of the hands, a match
// to 41 (51, 61 … after a tie at the target), and in about a quarter of the matches the last hand is a custom one on
// which a team calls "s ovim dosta". A tournament "na prolaz" has no call and no raise (a tie at the target plays one
// more hand), one "bez zvanja" no zvanja; ~1% of matches are closed by Vrijeme partije.
// History is written in bulk with ids taken here, so the hands go in in seconds and the ids are the same every run.
import {
  CUSTOM_HAND_MAX,
  handError,
  HAND_POINTS,
  matchState,
  MATCH_THRESHOLD,
  NO_ZVANJA,
  zvanjaColumns,
  zvanjaError,
  zvanjaPoints,
  type MatchEnd,
  type MatchState,
  type PlayedHand,
  type Side,
  type ZvanjaCounts,
} from "@/app/_lib/game/scoring";
import type {Prisma} from "@prisma/client";
import type {Rng} from "./rng";
import type {Ctx} from "./context";

export type {Side};

export type Hand = {
  // the points typed for each team (team1_game_points, team2_game_points); a normal hand adds up to 11
  p1: number;
  p2: number;
  z1: ZvanjaCounts;
  z2: ZvanjaCounts;
  // a custom hand: typed freely, no zvanja ("s ovim dosta" is called on one)
  custom: boolean;
  // the team that called "s ovim dosta" on this hand
  dosta: Side | null;
};

// How a table plays: with zvanja or "bez zvanja", "s ovim dosta" (a league) or "na prolaz" (some tournaments)
export type Rules = {declarations: boolean; end: MatchEnd};
export const LEAGUE_RULES: Rules = {declarations: true, end: "S_OVIM_DOSTA"};

export type PlayedMatch = {hands: Hand[]; score1: number; score2: number; winner: Side; timeExpired: boolean};

// a hand as game/scoring.ts and the database take it
export const playedHand = (h: Hand): PlayedHand => ({
  team1_game_points: h.p1,
  team2_game_points: h.p2,
  ...zvanjaColumns(h.z1, h.z2),
  dosta_side: h.dosta,
});

export const stateOf = (hands: Hand[], end: MatchEnd): MatchState => matchState(hands.map(playedHand), MATCH_THRESHOLD, end);

const other = (side: Side): Side => (side === 1 ? 2 : 1);

function normal(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
}

// one team's zvanja on a hand, or none
function teamZvanja(rng: Rng): ZvanjaCounts {
  if (!rng.chance(0.2)) return NO_ZVANJA;
  return rng.weighted<ZvanjaCounts>([
    [{3: 1, 4: 0}, 70],
    [{3: 2, 4: 0}, 14],
    [{3: 0, 4: 1}, 11],
    [{3: 1, 4: 1}, 4],
    [{3: 3, 4: 0}, 1],
  ]);
}

// One normal hand. edge > 0 favours team 1 (from the teams' hidden strength).
export function makeHand(rng: Rng, edge: number, declarations: boolean): Hand {
  let p1: number;
  if (rng.chance(0.02)) {
    // Kaput: one team took every trick
    p1 = rng.chance(0.5 + edge / 4) ? HAND_POINTS : 0;
  } else {
    p1 = Math.max(1, Math.min(HAND_POINTS - 1, Math.round(5.5 + 0.8 * edge + 1.8 * normal(rng))));
  }
  const p2 = HAND_POINTS - p1;
  let z1 = declarations ? teamZvanja(rng) : NO_ZVANJA;
  let z2 = declarations ? teamZvanja(rng) : NO_ZVANJA;
  // the cards can't give both teams these zvanja at once: team 2 shows none
  if (zvanjaError(z1, z2, {declarations}) !== null) z2 = NO_ZVANJA;
  if (zvanjaError(z1, z2, {declarations}) !== null) z1 = NO_ZVANJA;
  const error = handError(p1, p2, false);
  if (error) throw new Error(`generated an impossible hand ${p1}:${p2}: ${error}`);
  return {p1, p2, z1, z2, custom: false, dosta: null};
}

// The custom hand on which `caller` calls "s ovim dosta": the points counted so far in the hand, enough for the caller
// to reach the target with it. null when the caller is too far from the target for one hand.
export function dostaHand(rng: Rng, state: MatchState, caller: Side): Hand | null {
  const need = state.target - (caller === 1 ? state.score1 : state.score2);
  if (need < 1 || need > HAND_POINTS - 2) return null;
  const mine = need + rng.int(0, Math.min(2, HAND_POINTS - 1 - need));
  const theirs = rng.int(0, HAND_POINTS - 1 - mine);
  const [p1, p2] = caller === 1 ? [mine, theirs] : [theirs, mine];
  const error = handError(p1, p2, true);
  if (error || p1 > CUSTOM_HAND_MAX || p2 > CUSTOM_HAND_MAX) return null;
  return {p1, p2, z1: NO_ZVANJA, z2: NO_ZVANJA, custom: true, dosta: caller};
}

// A match played to its end as matchState decides it, or now and then closed by time with the score so far
export function playMatch(rng: Rng, edge: number, rules: Rules): PlayedMatch {
  const byTime = rng.chance(0.01);
  // in a league ("s ovim dosta") about a quarter of the matches end on a call
  const callsDosta = rules.end === "S_OVIM_DOSTA" && rng.chance(0.25);
  const hands: Hand[] = [];
  for (;;) {
    let state = stateOf(hands, rules.end);
    if (callsDosta && hands.length >= 3) {
      // the team nearer the target calls once one hand can take it there
      const caller: Side = state.target - state.score1 <= state.target - state.score2 ? 1 : 2;
      const hand = rng.chance(0.6) ? dostaHand(rng, state, caller) : null;
      if (hand) {
        hands.push(hand);
        state = stateOf(hands, rules.end);
        if (state.winner !== caller || state.callError) throw new Error(`a "s ovim dosta" call that doesn't stand: ${state.callError}`);
        return {hands, score1: state.score1, score2: state.score2, winner: caller, timeExpired: false};
      }
    }
    hands.push(makeHand(rng, edge, rules.declarations));
    state = stateOf(hands, rules.end);
    if (state.winner !== null) return {hands, score1: state.score1, score2: state.score2, winner: state.winner, timeExpired: false};
    if (byTime && hands.length >= 4 && state.score1 !== state.score2) {
      return {hands, score1: state.score1, score2: state.score2, winner: state.score1 > state.score2 ? 1 : 2, timeExpired: true};
    }
    if (hands.length > 40) throw new Error("a match that never ends");
  }
}

// Ids for bulk inserts: history takes them in order, then syncSequences moves the sequences past them so the app's own
// inserts (tonight, the tests) carry on from there
export type Ids = {round: number; match: number; result: number};

export function createIds(): Ids {
  return {round: 0, match: 0, result: 0};
}

export async function syncSequences(ctx: Ctx) {
  for (const [table, column] of [
    ["Round", "id"],
    ["Match", "id"],
    ["Result", "result_id"],
  ] as const) {
    await ctx.prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', '${column}'), COALESCE((SELECT MAX("${column}") FROM "${table}"), 0) + 1, false)`,
    );
  }
}

// Collects the rows of finished tables and writes them in a few createMany calls
export class TableWriter {
  rounds: Prisma.RoundCreateManyInput[] = [];
  leagueRounds: {league_id: number; round_id: number}[] = [];
  tournamentRounds: {tournament_id: number; round_id: number}[] = [];
  roundPlayers: {round_id: number; player_id: number; team_id: number}[] = [];
  matches: Prisma.MatchCreateManyInput[] = [];
  results: Prisma.ResultCreateManyInput[] = [];

  constructor(private ids: Ids) {}

  nextRoundId(): number {
    return ++this.ids.round;
  }

  // a match with its hands; times: when it started and ended
  addMatch(roundId: number, day: Date, played: PlayedMatch, start: Date | null, end: Date | null) {
    const matchId = ++this.ids.match;
    this.matches.push({
      id: matchId,
      round_id: roundId,
      player_pair1_score: played.score1,
      player_pair2_score: played.score2,
      score_threshold: MATCH_THRESHOLD,
      winner_side: played.winner,
      start_time: start,
      end_time: end,
      match_date: day,
      time_expired: played.timeExpired,
    });
    for (const hand of played.hands) {
      this.results.push({result_id: ++this.ids.result, match_id: matchId, ...resultColumns(hand)});
    }
  }

  // a match with no hands: the bye's 5 : 0, a no-show's 5 : 0
  addScoreOnly(roundId: number, day: Date, score1: number, score2: number, at: Date | null) {
    this.matches.push({
      id: ++this.ids.match,
      round_id: roundId,
      player_pair1_score: score1,
      player_pair2_score: score2,
      score_threshold: MATCH_THRESHOLD,
      winner_side: score1 > score2 ? 1 : 2,
      start_time: at,
      end_time: at,
      match_date: day,
      time_expired: false,
    });
  }

  async flush(ctx: Ctx) {
    const {prisma} = ctx;
    const chunk = async <T>(rows: T[], write: (part: T[]) => Promise<unknown>) => {
      for (let i = 0; i < rows.length; i += 2000) await write(rows.slice(i, i + 2000));
    };
    await chunk(this.rounds, (part) => prisma.round.createMany({data: part}));
    await chunk(this.leagueRounds, (part) => prisma.leagueRound.createMany({data: part}));
    await chunk(this.tournamentRounds, (part) => prisma.tournamentRound.createMany({data: part}));
    await chunk(this.roundPlayers, (part) => prisma.roundPlayer.createMany({data: part}));
    await chunk(this.matches, (part) => prisma.match.createMany({data: part}));
    await chunk(this.results, (part) => prisma.result.createMany({data: part}));
    const counts = `${this.rounds.length} tables, ${this.matches.length} matches, ${this.results.length} hands`;
    this.rounds = [];
    this.leagueRounds = [];
    this.tournamentRounds = [];
    this.roundPlayers = [];
    this.matches = [];
    this.results = [];
    return counts;
  }
}

// a hand's columns in Result and OngoingResult
export function resultColumns(hand: Hand) {
  return {
    team1_game_points: hand.p1,
    team2_game_points: hand.p2,
    ...zvanjaColumns(hand.z1, hand.z2),
    custom: hand.custom,
    dosta_side: hand.dosta,
  };
}

// a hand's total for each team: its points and its zvanja
export const handTotal = (hand: Hand): [number, number] => [hand.p1 + zvanjaPoints(hand.z1), hand.p2 + zvanjaPoints(hand.z2)];

// Each team's hidden strength, so the standings spread out as in a real league instead of everyone near 50%
export function strengths(rng: Rng, teamIds: number[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const id of teamIds) out.set(id, normal(rng));
  return out;
}

export function edgeOf(strength: Map<number, number>, team1: number, team2: number): number {
  return Math.max(-1.5, Math.min(1.5, ((strength.get(team1) ?? 0) - (strength.get(team2) ?? 0)) / 2));
}

// two players of a team for a table (Tko igra): the founders mostly, the third player now and then
export function lineup(rng: Rng, roster: number[]): number[] {
  if (roster.length <= 2) return roster;
  return rng.sample(roster, 2);
}

// Both lineups of a table. Two teams may share a player (production has players in two teams), but nobody plays for
// both sides (saveLineup refuses it): the first team plays without the shared player when it can.
export function lineups(rng: Rng, roster1: number[], roster2: number[]): [number[], number[]] {
  const own1 = roster1.filter((p) => !roster2.includes(p));
  const first = lineup(rng, own1.length >= Math.min(2, roster1.length) ? own1 : roster1);
  const second = lineup(rng, roster2.filter((p) => !first.includes(p)));
  return [first, second];
}

export {other};
