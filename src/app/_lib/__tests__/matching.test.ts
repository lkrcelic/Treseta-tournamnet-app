import {test} from "node:test";
import assert from "node:assert/strict";
import {generateMultipleRoundPairings, matchTeams, minLastWindow, Team, TeamPair} from "@/app/_lib/matching/multipleRoundMatching";
import {maxWeightMatching, WeightedEdge} from "@/app/_lib/matching/blossom";
import {BYE_TEAM_ID} from "@/app/_lib/bye";

// team 1 is ranked first, team `count` last
const makeTeams = (count: number): Team[] =>
  Array.from({length: count}, (_, i) => ({
    id: i + 1,
    name: `Team ${i + 1}`,
    score: count - i,
    point_difference: 0,
    played_against: [],
  }));

const meet = (teams: Team[], a: number, b: number, times = 1) => {
  for (let k = 0; k < times; k++) {
    teams[a - 1].played_against.push(b);
    teams[b - 1].played_against.push(a);
  }
};

const giveBye = (teams: Team[], id: number) => teams[id - 1].played_against.push(BYE_TEAM_ID);

const key = (p: TeamPair) => [p.teamOne.id, p.teamTwo.id].sort((a, b) => a - b).join("-");
const isBye = (p: TeamPair) => p.teamOne.id === BYE_TEAM_ID || p.teamTwo.id === BYE_TEAM_ID;
const byeTeamOf = (round: TeamPair[]) => {
  const p = round.find(isBye);
  return p ? (p.teamOne.id === BYE_TEAM_ID ? p.teamTwo.id : p.teamOne.id) : null;
};

const assertValidRound = (teams: Team[], pairs: TeamPair[]) => {
  const ids = pairs.flatMap((p) => [p.teamOne.id, p.teamTwo.id]).filter((id) => id !== BYE_TEAM_ID);
  assert.equal(new Set(ids).size, ids.length, "a team plays twice in one round");
  assert.deepEqual([...ids].sort((a, b) => a - b), teams.map((t) => t.id).sort((a, b) => a - b), "every team plays once");
};

const assertNoRepeats = (rounds: TeamPair[][]) => {
  const seen = new Set<string>();
  for (const round of rounds) {
    for (const p of round) {
      assert.ok(!seen.has(key(p)), `rematch ${key(p)}`);
      seen.add(key(p));
    }
  }
};

// deterministic pseudo random numbers for the generated cases
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

test("blossom finds the cheapest perfect matching (checked against trying every pairing)", () => {
  const random = rng(7);
  const bestByBruteForce = (n: number, cost: number[][]): number => {
    const go = (open: number[]): number => {
      if (open.length === 0) return 0;
      const [i, ...rest] = open;
      return Math.min(...rest.map((j) => cost[i][j] + go(rest.filter((k) => k !== j))));
    };
    return go(Array.from({length: n}, (_, i) => i));
  };
  for (let round = 0; round < 300; round++) {
    const n = 2 * (1 + Math.floor(random() * 5)); // 2..10
    const cost = Array.from({length: n}, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) cost[i][j] = cost[j][i] = Math.floor(random() * 30);
    const edges: WeightedEdge[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push([i, j, 100 - cost[i][j]]);
    const mate = maxWeightMatching(edges, true);
    assert.ok(mate.every((m, i) => m >= 0 && mate[m] === i), "perfect matching");
    const total = mate.reduce((sum, m, i) => (m > i ? sum + cost[i][m] : sum), 0);
    assert.equal(total, bestByBruteForce(n, cost), `n=${n}`);
  }
});

test("blossom without maxCardinality only takes edges that add weight", () => {
  assert.deepEqual(maxWeightMatching([[0, 1, 5], [1, 2, 11], [2, 3, 5]]), [-1, 2, 1, -1]);
  assert.deepEqual(maxWeightMatching([[0, 1, 5], [1, 2, 11], [2, 3, 5]], true), [1, 0, 3, 2]);
});

test("single round pairing works for every league size", () => {
  for (let count = 2; count <= 64; count++) {
    const teams = makeTeams(count);
    assertValidRound(teams, matchTeams(teams));
  }
});

test("odd number of teams gets exactly one bye, placed last", () => {
  const pairs = matchTeams(makeTeams(9));
  const byes = pairs.filter(isBye);
  assert.equal(byes.length, 1);
  assert.equal(pairs[pairs.length - 1], byes[0]);
});

test("the last window is at least max(rounds + 1, window / 2, 6) teams, or joins the one before", () => {
  assert.equal(minLastWindow(8, 3), 6);
  assert.equal(minLastWindow(16, 3), 8);
  assert.equal(minLastWindow(4, 1), 6);
  // 20 teams, window 8: 8 + 8 + 4, and the 4 are too few, so the second window has 12
  const teams = makeTeams(20);
  const {rounds} = generateMultipleRoundPairings(teams, {windowSize: 8, numberOfRounds: 3});
  for (const round of rounds) {
    for (const p of round) {
      const [a, b] = [p.teamOne.id, p.teamTwo.id].sort((x, y) => x - y);
      if (a <= 8) assert.ok(b <= 8, `${a} (first window) plays ${b}`);
      else assert.ok(b > 8, `${a} (second window) plays ${b}`);
    }
  }
  // 22 teams, window 8: 8 + 8 + 6, and 6 is enough, so team 17 only meets teams 17-22
  const {rounds: kept} = generateMultipleRoundPairings(makeTeams(22), {windowSize: 8, numberOfRounds: 3});
  for (const round of kept) {
    const p = round.find((x) => x.teamOne.id === 17 || x.teamTwo.id === 17)!;
    assert.ok(p.teamOne.id >= 17 && p.teamTwo.id >= 17);
  }
});

test("the bye goes to the lowest-ranked team without one, a different team each round", () => {
  const teams = makeTeams(9);
  giveBye(teams, 9);
  const {rounds} = generateMultipleRoundPairings(teams, {windowSize: 10, numberOfRounds: 3});
  assert.deepEqual(rounds.map(byeTeamOf), [8, 7, 6]);
  for (const round of rounds) assert.ok(isBye(round[round.length - 1]), "the bye table is last");
});

test("when every team has had a bye, the fewest byes wins, then the lowest rank", () => {
  const teams = makeTeams(7);
  for (let id = 1; id <= 7; id++) giveBye(teams, id);
  giveBye(teams, 7);
  giveBye(teams, 6);
  const {rounds} = generateMultipleRoundPairings(teams, {windowSize: 8, numberOfRounds: 2});
  assert.deepEqual(rounds.map(byeTeamOf), [5, 4]);
});

test("a team never gets the bye twice in one night, even with far fewer byes than the rest", () => {
  // 21 teams in windows of 8 and 13; team 12 joined late and is the only one in its window without byes
  const teams = makeTeams(21);
  for (let id = 9; id <= 21; id++) if (id !== 12) giveBye(teams, id), giveBye(teams, id);
  const {rounds, repeats} = generateMultipleRoundPairings(teams, {windowSize: 8, numberOfRounds: 3});
  assert.deepEqual(rounds.map(byeTeamOf), [12, 21, 20]);
  assert.deepEqual(repeats, []);
});

test("a team that had the bye in an earlier round today doesn't get it again", () => {
  const teams = makeTeams(7);
  const {rounds, repeats} = generateMultipleRoundPairings(teams, {
    windowSize: 8,
    numberOfRounds: 2,
    playedToday: [[7, BYE_TEAM_ID], [1, 2], [3, 4], [5, 6]],
  });
  assert.deepEqual(rounds.map(byeTeamOf), [6, 5]);
  assert.deepEqual(repeats, []);
});

test("the bye only comes up in the last window", () => {
  const {rounds} = generateMultipleRoundPairings(makeTeams(17), {windowSize: 8, numberOfRounds: 2});
  for (const round of rounds) assert.ok(byeTeamOf(round)! > 8);
});

test("earlier meetings are squared: two pairs that met once beat one pair that met twice", () => {
  const teams = makeTeams(4);
  meet(teams, 1, 2, 2); // 1-2 / 3-4 costs 4
  meet(teams, 1, 3); // 1-3 / 2-4 costs 1 + 1 = 2
  meet(teams, 2, 4);
  meet(teams, 1, 4, 3); // 1-4 / 2-3 costs 9 + 1
  meet(teams, 2, 3);
  const {rounds} = generateMultipleRoundPairings(teams, {windowSize: 4, numberOfRounds: 1});
  assert.deepEqual(rounds[0].map(key).sort(), ["1-3", "2-4"]);
});

test("multiple rounds never repeat a matchup, even a full round robin", () => {
  const random = rng(42);
  for (const [count, windowSize, numberOfRounds] of [
    [16, 8, 3],
    [6, 6, 5],
    [7, 8, 5],
    [8, 8, 5],
    [12, 12, 5],
    [26, 8, 5],
  ]) {
    const teams = makeTeams(count);
    // a season of history so the cheapest pairings pull towards repeats
    for (let k = 0; k < count * 4; k++) {
      const a = 1 + Math.floor(random() * count);
      const b = 1 + Math.floor(random() * count);
      if (a !== b) meet(teams, a, b);
    }
    const {rounds, repeats} = generateMultipleRoundPairings(teams, {windowSize, numberOfRounds});
    assert.equal(rounds.length, numberOfRounds);
    assert.deepEqual(repeats, [], `${count} teams`);
    rounds.forEach((round) => assertValidRound(teams, round));
    assertNoRepeats(rounds);
  }
});

test("today's earlier rounds count: teams that already met today don't meet again", () => {
  const teams = makeTeams(6);
  const playedToday: [number, number][] = [
    [1, 2],
    [3, 4],
    [5, 6],
  ];
  const {rounds, repeats} = generateMultipleRoundPairings(teams, {windowSize: 6, numberOfRounds: 3, playedToday});
  assert.deepEqual(repeats, []);
  assertNoRepeats([playedToday.map(([a, b]) => ({teamOne: teams[a - 1], teamTwo: teams[b - 1]})), ...rounds]);
});

test("a night that can't avoid a rematch still comes back, with the pairs that meet twice", () => {
  const teams = makeTeams(4);
  // all three ways to pair four teams are already used today
  const playedToday: [number, number][] = [
    [1, 2], [3, 4],
    [1, 3], [2, 4],
    [1, 4], [2, 3],
  ];
  const {rounds, repeats} = generateMultipleRoundPairings(teams, {windowSize: 4, numberOfRounds: 1, playedToday});
  assertValidRound(teams, rounds[0]);
  assert.equal(repeats.length, 2);
});

test("ties are broken the same way every time", () => {
  const a = generateMultipleRoundPairings(makeTeams(24), {windowSize: 8, numberOfRounds: 4});
  const b = generateMultipleRoundPairings(makeTeams(24), {windowSize: 8, numberOfRounds: 4});
  assert.deepEqual(a.rounds.map((r) => r.map(key)), b.rounds.map((r) => r.map(key)));
});

test("a big league is paired fast", () => {
  const random = rng(3);
  const teams = makeTeams(121);
  for (let k = 0; k < 2000; k++) {
    const a = 1 + Math.floor(random() * 121);
    const b = 1 + Math.floor(random() * 121);
    if (a !== b) meet(teams, a, b);
  }
  const started = Date.now();
  const {rounds, repeats} = generateMultipleRoundPairings(teams, {windowSize: 200, numberOfRounds: 5});
  const took = Date.now() - started;
  assert.deepEqual(repeats, []);
  rounds.forEach((round) => assertValidRound(teams, round));
  assert.ok(took < 10000, `took ${took} ms`);
});
