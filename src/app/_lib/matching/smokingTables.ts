import {isByeTeam} from "@/app/_lib/bye";
import {TeamPair} from "./multipleRoundMatching";

// Smoking tables (Claude Design "Pušači i pušački stolovi"). The pairing is made first, by standings; smoking tables
// only decide where a match sits. In every round the matches whose teams need a smoking table most get them, in the
// order of the table numbers:
//   1. teams that haven't sat at a smoking table tonight come first, and of those the teams that went the most
//      earlier nights with a smoker but without a smoking table (stronger than having more smokers);
//   2. then the match with more points: one per smoker at the table, ten more for every team that hasn't sat at
//      one tonight, and one per round a team is below its fair share this season (or minus one per round above it).
// A team's fair share counts, in every round with smoking tables, its part of the smoking seats split among the
// smoking teams by their smokers, so a team with more smokers sits at a smoking table more often, while every smoking
// team rotates in.

// A team's smoking record this season (one league), as it stands before new rounds are seated
export type SmokingRecord = {
  // rounds it sat at a smoking table (tonight's earlier rounds included)
  smokingRounds: number;
  // its fair share of those (see above)
  fairShare: number;
  // earlier nights it had a smoker at a round with smoking tables but sat at none of them
  missedNights: number;
  // rounds at a smoking table tonight (rounds created earlier tonight)
  tonight: number;
};

export const emptyRecord = (): SmokingRecord => ({smokingRounds: 0, fairShare: 0, missedNights: 0, tonight: 0});

export type SmokingSetup = {
  // the table numbers where smoking is allowed
  tables: readonly number[];
  // smokers on each team's roster now (teams without smokers can be left out)
  smokers: ReadonlyMap<number, number>;
  // the season so far (a team without a record starts empty)
  records: ReadonlyMap<number, SmokingRecord>;
};

export type SeatedPair = TeamPair & {table: number; smoking: boolean};

// a team that hasn't sat at a smoking table tonight is worth this many smokers
const NOT_YET_TONIGHT = 10;
// a fair share above or below the actual rounds moves a team at most this many points
const SHARE_LIMIT = 3;

const isByePair = (p: TeamPair) => isByeTeam(p.teamOne.id) || isByeTeam(p.teamTwo.id);

/**
 * Gives every pair of every round its table: 1, 2, ... in the order the pairing made them (best ranked first), the
 * bye after every real table. With smoking tables, the matches whose teams need them most sit there (see the top of
 * this file); the other matches keep their order on the other tables. Smoking tables above a round's number of
 * tables are left out of that round.
 */
export function seatRounds(rounds: TeamPair[][], setup?: SmokingSetup | null): SeatedPair[][] {
  const tables = Array.from(new Set(setup?.tables ?? []))
    .filter((t) => Number.isInteger(t) && t > 0)
    .sort((a, b) => a - b);
  const smokers = setup?.smokers ?? new Map<number, number>();
  // copies, so the rounds seated first count for the ones after them
  const records = new Map<number, SmokingRecord>();
  setup?.records.forEach((r, id) => records.set(id, {...r}));
  const recordOf = (id: number) => {
    if (!records.has(id)) records.set(id, emptyRecord());
    return records.get(id)!;
  };
  const smokersOf = (id: number) => (isByeTeam(id) ? 0 : Math.max(0, smokers.get(id) ?? 0));

  return rounds.map((round) => {
    const real = round.filter((p) => !isByePair(p));
    const byes = round.filter(isByePair);
    const smokingTables = tables.filter((t) => t <= real.length);
    const seats = new Map<TeamPair, {table: number; smoking: boolean}>();

    if (smokingTables.length > 0) {
      const chosen = real
        .map((pair, index) => ({pair, index, need: matchNeed(pair, smokersOf, recordOf)}))
        .filter((m) => m.need != null)
        .sort((a, b) => b.need!.tier - a.need!.tier || b.need!.points - a.need!.points || a.index - b.index)
        .slice(0, smokingTables.length);
      chosen.forEach((m, i) => seats.set(m.pair, {table: smokingTables[i], smoking: true}));
      updateRecords(real, seats, smokingTables.length, smokersOf, recordOf);
    }

    // the other matches, in their order, take the free table numbers (also a smoking table no smoking team needed)
    const taken = new Set(Array.from(seats.values(), (s) => s.table));
    const free = Array.from({length: real.length}, (_, i) => i + 1).filter((t) => !taken.has(t));
    real.filter((p) => !seats.has(p)).forEach((p, i) => seats.set(p, {table: free[i], smoking: smokingTables.includes(free[i])}));

    const seated: SeatedPair[] = real.map((p) => ({...p, ...seats.get(p)!})).sort((a, b) => a.table - b.table);
    byes.forEach((p, i) => seated.push({...p, table: real.length + i + 1, smoking: false}));
    return seated;
  });
}

type Need = {
  // the most earlier nights without a smoking table among its teams that haven't sat at one tonight; -1 when every
  // smoking team of the match already sat at one tonight
  tier: number;
  points: number;
};

// How much a match needs a smoking table; null when neither team has a smoker
function matchNeed(pair: TeamPair, smokersOf: (id: number) => number, recordOf: (id: number) => SmokingRecord): Need | null {
  let need: Need | null = null;
  for (const id of [pair.teamOne.id, pair.teamTwo.id]) {
    const smokers = smokersOf(id);
    if (smokers === 0) continue;
    const record = recordOf(id);
    const notYet = record.tonight === 0;
    const behind = Math.max(-SHARE_LIMIT, Math.min(SHARE_LIMIT, record.fairShare - record.smokingRounds));
    need ??= {tier: -1, points: 0};
    if (notYet) need.tier = Math.max(need.tier, record.missedNights);
    need.points += smokers + behind + (notYet ? NOT_YET_TONIGHT : 0);
  }
  return need;
}

// After a round is seated: every smoking team at a real table gets its fair share of the round's smoking seats, and
// the ones at a smoking table one more smoking round
function updateRecords(
  real: TeamPair[],
  seats: Map<TeamPair, {table: number; smoking: boolean}>,
  smokingTables: number,
  smokersOf: (id: number) => number,
  recordOf: (id: number) => SmokingRecord
) {
  const playing = real.flatMap((p) => [p.teamOne.id, p.teamTwo.id]).filter((id) => smokersOf(id) > 0);
  const shares = fairShares(2 * smokingTables, playing.map(smokersOf));
  playing.forEach((id, i) => (recordOf(id).fairShare += shares[i]));
  for (const [pair, seat] of Array.from(seats)) {
    if (!seat.smoking) continue;
    for (const id of [pair.teamOne.id, pair.teamTwo.id]) {
      if (smokersOf(id) === 0) continue;
      recordOf(id).smokingRounds += 1;
      recordOf(id).tonight += 1;
    }
  }
}

/**
 * Splits `seats` smoking seats among teams in proportion to their smokers (`weights`). A team sits at one table per
 * round, so no share is above 1; what a capped team can't use goes to the others.
 */
export function fairShares(seats: number, weights: number[]): number[] {
  const shares = weights.map(() => 0);
  let left = Math.min(seats, weights.length);
  let weight = weights.reduce((sum, w) => sum + w, 0);
  const order = weights.map((w, i) => i).sort((a, b) => weights[b] - weights[a]);
  for (const i of order) {
    if (left <= 0 || weight <= 0) break;
    const share = Math.min(1, (left * weights[i]) / weight);
    shares[i] = share;
    left -= share;
    weight -= weights[i];
  }
  return shares;
}

// One table of a league round as the rotation reads it from the database
export type SmokingRound = {
  date: string; // YYYY-MM-DD
  roundNumber: number | null;
  team1Id: number;
  team2Id: number;
  team1Smokers: number;
  team2Smokers: number;
  smoking: boolean;
};

/**
 * Every team's smoking record from the league's tables up to tonight (`today`, YYYY-MM-DD). A round counts when at
 * least one of its tables is a smoking table; a team counts in it while it had a smoker when it was seated. A night
 * before today counts as missed when the team had a smoker at such a round and sat at no smoking table that night.
 */
export function smokingRecords(rounds: SmokingRound[], today: string): Map<number, SmokingRecord> {
  const records = new Map<number, SmokingRecord>();
  const recordOf = (id: number) => {
    if (!records.has(id)) records.set(id, emptyRecord());
    return records.get(id)!;
  };

  const groups = new Map<string, SmokingRound[]>();
  for (const r of rounds) {
    if (r.date > today || isByeTeam(r.team1Id) || isByeTeam(r.team2Id)) continue;
    const key = `${r.date}|${r.roundNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  // per night: the smoking teams that could have sat at a smoking table, and the ones that did
  const nights = new Map<string, {could: Set<number>; did: Set<number>}>();
  for (const tables of Array.from(groups.values())) {
    const smokingTables = tables.filter((t) => t.smoking).length;
    if (smokingTables === 0) continue;
    const date = tables[0].date;
    if (!nights.has(date)) nights.set(date, {could: new Set(), did: new Set()});
    const night = nights.get(date)!;

    const seated = tables.flatMap((t) => [
      {id: t.team1Id, smokers: t.team1Smokers, smoking: t.smoking},
      {id: t.team2Id, smokers: t.team2Smokers, smoking: t.smoking},
    ]).filter((s) => s.smokers > 0);
    const shares = fairShares(2 * smokingTables, seated.map((s) => s.smokers));
    seated.forEach((s, i) => {
      const record = recordOf(s.id);
      record.fairShare += shares[i];
      night.could.add(s.id);
      if (!s.smoking) return;
      record.smokingRounds += 1;
      if (date === today) record.tonight += 1;
      night.did.add(s.id);
    });
  }

  for (const [date, night] of Array.from(nights)) {
    if (date >= today) continue;
    night.could.forEach((id) => {
      if (!night.did.has(id)) recordOf(id).missedNights += 1;
    });
  }
  return records;
}
