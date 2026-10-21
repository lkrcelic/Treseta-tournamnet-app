import {test} from "node:test";
import assert from "node:assert/strict";
import {AGE_GAP_CAP, ageGap, generateMultipleRoundPairings, Team, TeamPair} from "@/app/_lib/matching/multipleRoundMatching";
import {ageInYears, averageAge, DEFAULT_AGE, MIN_AGE} from "@/app/_lib/matching/teamAges";
import {BYE_TEAM_ID} from "@/app/_lib/bye";

// team 1 is ranked first, team `ages.length` last; ages[i] is team i + 1's average age (null: unknown)
const makeTeams = (ages: (number | null)[]): Team[] =>
  ages.map((age, i) => ({
    id: i + 1,
    name: `Team ${i + 1}`,
    score: ages.length - i,
    point_difference: 0,
    played_against: [],
    average_age: age,
  }));

const meet = (teams: Team[], a: number, b: number, times = 1) => {
  for (let k = 0; k < times; k++) {
    teams[a - 1].played_against.push(b);
    teams[b - 1].played_against.push(a);
  }
};

const key = (p: TeamPair) => [p.teamOne.id, p.teamTwo.id].sort((a, b) => a - b).join("-");
const keys = (round: TeamPair[]) => round.map(key).sort();
const isBye = (p: TeamPair) => p.teamOne.id === BYE_TEAM_ID || p.teamTwo.id === BYE_TEAM_ID;

const assertValidRound = (teams: Team[], pairs: TeamPair[]) => {
  const ids = pairs.flatMap((p) => [p.teamOne.id, p.teamTwo.id]).filter((id) => id !== BYE_TEAM_ID);
  assert.equal(new Set(ids).size, ids.length, "a team plays twice in one round");
  assert.deepEqual([...ids].sort((a, b) => a - b), teams.map((t) => t.id).sort((a, b) => a - b), "every team plays once");
};

const assertNoRepeats = (rounds: TeamPair[][]) => {
  const seen = new Set<string>();
  for (const p of rounds.flat()) {
    assert.ok(!seen.has(key(p)), `rematch ${key(p)}`);
    seen.add(key(p));
  }
};

const meetings = (a: Team, b: Team) => a.played_against.filter((id) => id === b.id).length;

// deterministic pseudo random numbers for the generated cases
const rng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

// --- the team's age ---

test("ageInYears counts the part of the year since the birthday", () => {
  const birth = new Date("1990-03-15T00:00:00.000Z");
  assert.equal(Math.floor(ageInYears(birth, new Date("2026-03-14T00:00:00.000Z"))), 35, "the day before the 36th birthday");
  assert.equal(Math.floor(ageInYears(birth, new Date("2026-03-16T00:00:00.000Z"))), 36, "the day after it");
  const half = ageInYears(birth, new Date("2026-09-14T00:00:00.000Z"));
  assert.ok(half > 36.4 && half < 36.6, `about 36.5, got ${half}`);
});

test("averageAge averages the players' ages", () => {
  const today = new Date("2026-10-21T00:00:00.000Z");
  const age = averageAge([new Date("1996-10-21T00:00:00.000Z"), new Date("1976-10-21T00:00:00.000Z")], today);
  assert.ok(Math.abs(age! - 40) < 0.01, `30 and 50 average 40, got ${age}`);
});

test("a player without a birth date counts as 24", () => {
  const today = new Date("2026-10-21T00:00:00.000Z");
  assert.equal(DEFAULT_AGE, 24);
  const age = averageAge([new Date("1986-10-21T00:00:00.000Z"), null], today);
  assert.ok(Math.abs(age! - 32) < 0.01, `40 and 24 average 32, got ${age}`);
  assert.equal(averageAge([null, undefined], today), 24, "no birth date at all: 24, not unknown");
});

test("a birth date under 18 years counts as no birth date: 24", () => {
  const today = new Date("2026-10-21T00:00:00.000Z");
  assert.equal(MIN_AGE, 18);
  assert.equal(averageAge([today], today), 24, "born today (the date field's slip): 24, not 0");
  assert.equal(averageAge([new Date("2024-06-07T00:00:00.000Z")], today), 24, "2 years old: 24");
  assert.equal(averageAge([new Date("2008-10-22T00:00:00.000Z")], today), 24, "a day before the 18th birthday: 24");
  const eighteen = averageAge([new Date("2008-10-20T00:00:00.000Z")], today);
  assert.ok(eighteen! > 18 && eighteen! < 18.01, `a day after the 18th birthday counts as they are, got ${eighteen}`);
  const team = averageAge([new Date("1986-10-21T00:00:00.000Z"), today], today);
  assert.ok(Math.abs(team! - 32) < 0.01, `40 and a slip average 32, got ${team}`);
});

test("only a team without players has no age", () => {
  assert.equal(averageAge([], new Date("2026-10-21T00:00:00.000Z")), null);
});

test("ageGap is whole years, capped; an unknown age is halfway to the cap from a known one", () => {
  const [a, b, c, d] = makeTeams([30, 34.6, null, 95]);
  assert.equal(ageGap(a, b), 5, "4.6 years round to 5");
  assert.equal(ageGap(b, a), 5, "symmetric");
  assert.equal(ageGap(a, a), 0);
  assert.equal(ageGap(a, d), AGE_GAP_CAP, "65 years apart is the cap");
  assert.equal(ageGap(a, c), AGE_GAP_CAP / 2, "unknown against known: the same for every known age");
  assert.equal(ageGap(d, c), AGE_GAP_CAP / 2);
  assert.equal(ageGap(c, c), 0, "two unknown ages are close");
  assert.equal(ageGap({...a, average_age: undefined}, {...b, average_age: undefined}), 0, "an age left out counts as unknown");
});

// --- the age in the pairing ---

test("in a new league, teams of a similar age meet", () => {
  // ranked 1..4, ages mixed so that the ranking alone would pair them differently
  const teams = makeTeams([25, 60, 26, 61]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 4, numberOfRounds: 1});
  assert.deepEqual(keys(plan.rounds[0]), ["1-3", "2-4"]);
});

test("the age picks the cheapest pairing out of all of them", () => {
  const teams = makeTeams([20, 45, 33, 70, 21, 46, 34, 71]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 8, numberOfRounds: 1});
  assert.deepEqual(keys(plan.rounds[0]), ["1-5", "2-6", "3-7", "4-8"]);
});

test("the age never makes teams meet again: an earlier meeting outweighs any age gap", () => {
  // 1 and 2 are the same age but already met; 3 and 4 too. Every other pair is the age cap apart.
  const teams = makeTeams([20, 20, 90, 90]);
  meet(teams, 1, 2);
  meet(teams, 3, 4);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 4, numberOfRounds: 1});
  for (const p of plan.rounds[0]) assert.notEqual(meetings(p.teamOne, p.teamTwo), 1, `${key(p)} met before`);
});

test("the age never makes a pair meet a third time to spare two pairs a second", () => {
  // 1-2 met twice (cost 4); 1-3 and 2-4 met once (cost 1 + 1). 1-2 and 3-4 are the same ages, 1-3 / 2-4 far apart.
  const teams = makeTeams([30, 30, 80, 80]);
  meet(teams, 1, 2, 2);
  meet(teams, 1, 3);
  meet(teams, 2, 4);
  meet(teams, 1, 4, 3);
  meet(teams, 2, 3, 3);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 4, numberOfRounds: 1});
  assert.deepEqual(keys(plan.rounds[0]), ["1-3", "2-4"]);
});

test("the age never makes a pair meet twice tonight", () => {
  const teams = makeTeams([20, 20, 70, 70, 21, 71]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 6, numberOfRounds: 1, playedToday: [[1, 2], [3, 4]]});
  assert.equal(plan.repeats.length, 0);
  assert.ok(!keys(plan.rounds[0]).includes("1-2"));
  assert.ok(!keys(plan.rounds[0]).includes("3-4"));
  // what's left still goes by age: the two 20s meet the 21, the 70s the 71
  assert.ok(keys(plan.rounds[0]).includes("1-5") || keys(plan.rounds[0]).includes("2-5"));
});

test("the age never moves a team out of its window: the standings come first", () => {
  // windows 1-6 and 7-12; team 1 and team 12 are the only 70-year-olds
  const teams = makeTeams([70, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 70]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 6, numberOfRounds: 1});
  for (const p of plan.rounds[0]) {
    const window = (id: number) => (id <= 6 ? 0 : 1);
    assert.equal(window(p.teamOne.id), window(p.teamTwo.id), `${key(p)} crosses windows`);
  }
});

test("the age doesn't decide the bye: it goes to the lowest ranked team, as before", () => {
  const teams = makeTeams([20, 21, 50, 51, 99]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 6, numberOfRounds: 1});
  const bye = plan.rounds[0].find(isBye)!;
  assert.equal(bye.teamOne.id, 5);
  assert.deepEqual(keys(plan.rounds[0].filter((p) => !isBye(p))), ["1-2", "3-4"]);
});

test("teams of unknown age don't break up teams of a similar age: they play each other", () => {
  // were an unknown age close to everyone, 2-5 and 3-6 would cost nothing and split 60 from 61
  const teams = makeTeams([20, null, 60, 21, 61, null]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 6, numberOfRounds: 1});
  assert.deepEqual(keys(plan.rounds[0]), ["1-4", "2-6", "3-5"]);
});

test("a single team of unknown age takes the team the ages leave over", () => {
  const teams = makeTeams([20, null, 21, 60]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 4, numberOfRounds: 1});
  assert.deepEqual(keys(plan.rounds[0]), ["1-3", "2-4"]);
});

test("a team of unknown age is still paired by earlier meetings first", () => {
  // 2 and 4 (both unknown) already met, so they don't meet again though their ages would be the closest
  const teams = makeTeams([20, null, 21, null]);
  meet(teams, 2, 4);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 4, numberOfRounds: 1});
  assert.ok(!keys(plan.rounds[0]).includes("2-4"));
});

test("without any ages the pairing is the same as before ages existed", () => {
  const random = rng(11);
  for (let c = 0; c < 30; c++) {
    const n = 6 + Math.floor(random() * 9);
    const rounds = 1 + Math.floor(random() * 3);
    const withNull = makeTeams(new Array(n).fill(null));
    // the same teams as they were before the age existed: no average_age at all
    const without: Team[] = withNull.map((t) => ({id: t.id, name: t.name, score: t.score, point_difference: t.point_difference, played_against: []}));
    for (let k = 0; k < n; k++) {
      const a = 1 + Math.floor(random() * n);
      const b = 1 + Math.floor(random() * n);
      if (a !== b) {
        meet(withNull, a, b);
        meet(without, a, b);
      }
    }
    const options = {windowSize: 2 * Math.ceil(n / 2) + 2, numberOfRounds: rounds};
    const one = generateMultipleRoundPairings(withNull, options);
    const two = generateMultipleRoundPairings(without, options);
    assert.deepEqual(one.rounds.map(keys), two.rounds.map(keys), `case ${c}`);
  }
});

test("over a night the ages never cost a repeat: a fresh league still gets one without", () => {
  const random = rng(3);
  for (let c = 0; c < 40; c++) {
    const n = 6 + Math.floor(random() * 15);
    const rounds = 1 + Math.floor(random() * Math.min(4, (n - 1) / 2));
    const teams = makeTeams(Array.from({length: n}, () => (random() < 0.15 ? null : 18 + random() * 60)));
    const plan = generateMultipleRoundPairings(teams, {windowSize: 2 * Math.ceil(n / 2), numberOfRounds: rounds});
    assert.equal(plan.repeats.length, 0, `case ${c}: n=${n} rounds=${rounds}`);
    plan.rounds.forEach((round) => assertValidRound(teams, round));
    assertNoRepeats(plan.rounds);
  }
});

test("a round is the best pairing by earlier meetings first and by age second (checked against every pairing)", () => {
  const random = rng(42);
  type Best = {meet: number; age: number};
  // the best of all pairings of `open`: fewest meetings squared, then the smallest age gap
  const best = (open: Team[]): Best => {
    if (open.length === 0) return {meet: 0, age: 0};
    const [a, ...rest] = open;
    let found: Best | null = null;
    for (const b of rest) {
      const after = best(rest.filter((t) => t !== b));
      const option = {meet: meetings(a, b) ** 2 + after.meet, age: ageGap(a, b) + after.age};
      if (!found || option.meet < found.meet || (option.meet === found.meet && option.age < found.age)) found = option;
    }
    return found!;
  };
  for (let c = 0; c < 300; c++) {
    const n = 3 + Math.floor(random() * 8); // 3..10, odd counts get a bye
    const teams = makeTeams(Array.from({length: n}, () => (random() < 0.2 ? null : 18 + random() * 70)));
    for (let k = 0; k < Math.floor(random() * 2 * n); k++) {
      const a = 1 + Math.floor(random() * n);
      const b = 1 + Math.floor(random() * n);
      if (a !== b) meet(teams, a, b);
    }
    const plan = generateMultipleRoundPairings(teams, {windowSize: 2 * Math.ceil(n / 2), numberOfRounds: 1});
    const round = plan.rounds[0];
    assertValidRound(teams, round);
    const real = round.filter((p) => !isBye(p));
    const playing = real.flatMap((p) => [p.teamOne, p.teamTwo]);
    const got = {
      meet: real.reduce((sum, p) => sum + meetings(p.teamOne, p.teamTwo) ** 2, 0),
      age: real.reduce((sum, p) => sum + ageGap(p.teamOne, p.teamTwo), 0),
    };
    assert.deepEqual(got, best(playing), `case ${c}: n=${n}`);
  }
});

test("a big window with a long season stays exact and fast", () => {
  const random = rng(5);
  const n = 200;
  const teams = makeTeams(Array.from({length: n}, () => 18 + random() * 60));
  for (let k = 0; k < 20 * n; k++) {
    const a = 1 + Math.floor(random() * n);
    const b = 1 + Math.floor(random() * n);
    if (a !== b) meet(teams, a, b);
  }
  const started = Date.now();
  const plan = generateMultipleRoundPairings(teams, {windowSize: 200, numberOfRounds: 5});
  assert.ok(Date.now() - started < 20000, "the pairing took too long");
  assert.equal(plan.repeats.length, 0);
  plan.rounds.forEach((round) => assertValidRound(teams, round));
  assertNoRepeats(plan.rounds);
});

test("the ages pair the closest teams together when several rounds are planned", () => {
  // two age groups of four: round 1 stays inside the groups; the night has no repeats
  const teams = makeTeams([20, 70, 21, 71, 22, 72, 23, 73]);
  const plan = generateMultipleRoundPairings(teams, {windowSize: 8, numberOfRounds: 3});
  assertNoRepeats(plan.rounds);
  for (const round of plan.rounds) {
    assertValidRound(teams, round);
    for (const p of round) {
      const group = (t: Team) => (t.average_age! < 50 ? 0 : 1);
      assert.equal(group(p.teamOne), group(p.teamTwo), `${key(p)} mixes age groups though each group can play 3 rounds`);
    }
  }
});
