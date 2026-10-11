import {test} from "node:test";
import assert from "node:assert/strict";
import {Game, initialRating, PHI0, PlayerRating, ratePeriod} from "@/app/_lib/rating/glicko2";
import {RatedRound, replaySeason, roundGames} from "@/app/_lib/rating/season";

const near = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} instead of ${expected}`);

test("matches the worked example in Glickman's Glicko-2 paper", () => {
  // player 1 (1500, RD 200) beats 1400/30, loses to 1550/100 and to 1700/300 in one period
  const ratings = new Map<number, PlayerRating>([
    [1, {rating: 1500, rd: 200, vol: 0.06}],
    [2, {rating: 1400, rd: 30, vol: 0.06}],
    [3, {rating: 1550, rd: 100, vol: 0.06}],
    [4, {rating: 1700, rd: 300, vol: 0.06}],
  ]);
  const games: Game[] = [
    {teamA: [1], teamB: [2], scoreA: 1},
    {teamA: [1], teamB: [3], scoreA: 0},
    {teamA: [1], teamB: [4], scoreA: 0},
  ];
  const p = ratePeriod(ratings, games).get(1)!;
  near(p.rating, 1464.06, 0.05, "rating");
  near(p.rd, 151.52, 0.05, "RD");
  near(p.vol, 0.05999, 0.00001, "volatility");
});

const fresh = (...ids: number[]) => new Map(ids.map((id) => [id, initialRating()]));

test("new players move a lot: two match wins between new teams of two", () => {
  const after = ratePeriod(fresh(1, 2, 3, 4), [
    {teamA: [1, 2], teamB: [3, 4], scoreA: 1},
    {teamA: [1, 2], teamB: [3, 4], scoreA: 1},
  ]);
  const gain = after.get(1)!.rating - 1500;
  assert.ok(gain > 150 && gain < 300, `gain ${gain}`);
  near(after.get(3)!.rating - 1500, -gain, 1e-9, "the losers lose what the winners gain");
  assert.ok(after.get(1)!.rd < PHI0);
});

test("a 1:1 night between equal teams changes no rating", () => {
  const after = ratePeriod(fresh(1, 2, 3, 4), [
    {teamA: [1, 2], teamB: [3, 4], scoreA: 1},
    {teamA: [1, 2], teamB: [3, 4], scoreA: 0},
  ]);
  for (const id of [1, 2, 3, 4]) near(after.get(id)!.rating, 1500, 1e-9, `player ${id}`);
});

test("a settled player moves less than a new teammate for the same result", () => {
  const ratings = new Map<number, PlayerRating>([
    [1, {rating: 1500, rd: 60, vol: 0.06}],
    [2, initialRating()],
    [3, {rating: 1500, rd: 60, vol: 0.06}],
    [4, {rating: 1500, rd: 60, vol: 0.06}],
  ]);
  const after = ratePeriod(ratings, [{teamA: [1, 2], teamB: [3, 4], scoreA: 1}]);
  const settled = after.get(1)!.rating - 1500;
  const newcomer = after.get(2)!.rating - 1500;
  assert.ok(settled > 0 && newcomer > settled * 3, `settled ${settled}, newcomer ${newcomer}`);
});

test("beating a stronger team counts more than beating a weaker one", () => {
  const ratings = new Map<number, PlayerRating>([
    [1, {rating: 1500, rd: 100, vol: 0.06}],
    [2, {rating: 1500, rd: 100, vol: 0.06}],
    [3, {rating: 1700, rd: 100, vol: 0.06}],
    [4, {rating: 1700, rd: 100, vol: 0.06}],
    [5, {rating: 1300, rd: 100, vol: 0.06}],
    [6, {rating: 1300, rd: 100, vol: 0.06}],
  ]);
  const strong = ratePeriod(ratings, [{teamA: [1, 2], teamB: [3, 4], scoreA: 1}]).get(1)!.rating - 1500;
  const weak = ratePeriod(ratings, [{teamA: [1, 2], teamB: [5, 6], scoreA: 1}]).get(1)!.rating - 1500;
  assert.ok(strong > weak * 2, `strong ${strong}, weak ${weak}`);
});

test("skipping a night only makes a rating less certain, never above the starting RD", () => {
  const ratings = new Map<number, PlayerRating>([
    [1, {rating: 1620, rd: 80, vol: 0.06}],
    [2, initialRating()],
  ]);
  const after = ratePeriod(ratings, []);
  assert.equal(after.get(1)!.rating, 1620);
  assert.ok(after.get(1)!.rd > 80);
  assert.equal(after.get(2)!.rd, PHI0);
});

test("players not known yet start at the defaults", () => {
  const after = ratePeriod(new Map(), [{teamA: [7, 8], teamB: [9], scoreA: 0}]);
  assert.ok(after.get(7)!.rating < 1500);
  assert.ok(after.get(9)!.rating > 1500);
});

const round = (night: string, teamA: number[], teamB: number[], matches: [number, number][], wins: [number, number] = [0, 0]): RatedRound => ({night, teamA, teamB, matches, wins});

test("every match of a round is a game; without stored matches the wins are used", () => {
  assert.deepEqual(roundGames(round("2026-01-01", [1], [2], [[1001, 700], [800, 1001]])).map((g) => g.scoreA), [1, 0]);
  assert.deepEqual(roundGames(round("2026-01-01", [1], [2], [], [2, 0])).map((g) => g.scoreA), [1, 1]);
});

test("a night is one rating period: the order of its rounds doesn't matter", () => {
  const r1 = round("2026-01-08", [1, 2], [3, 4], [[1001, 500], [1001, 600]]);
  const r2 = round("2026-01-08", [1, 2], [5, 6], [[400, 1001], [1001, 900]]);
  const ids = [1, 2, 3, 4, 5, 6];
  const a = replaySeason(ids, [r1, r2]).ratings;
  const b = replaySeason(ids, [r2, r1]).ratings;
  for (const id of ids) near(a.get(id)!.rating, b.get(id)!.rating, 1e-9, `player ${id}`);
});

test("the history has a row per player per night played, with the change and rounds", () => {
  const {ratings, history} = replaySeason(
    [1, 2, 3, 4, 5],
    [
      round("2026-01-08", [1, 2], [3, 4], [[1001, 500], [1001, 600]]),
      round("2026-01-08", [1, 2], [3, 4], [[1001, 500], [900, 1001]]),
      round("2026-01-15", [1, 5], [3, 4], [[700, 1001], [600, 1001]]),
    ]
  );
  const of = (id: number) => history.filter((h) => h.playerId === id);
  assert.equal(of(1).length, 2);
  assert.deepEqual(of(1).map((h) => h.rounds), [2, 1]);
  assert.equal(of(5).length, 1);
  assert.ok(of(1)[0].change > 0 && of(1)[1].change < 0);
  // the last row is the current rating
  assert.equal(of(1)[1].rating, Math.round(ratings.get(1)!.rating));
  // player 2 sat out the second night: same rating, less certain
  assert.equal(Math.round(ratings.get(2)!.rating), of(2)[0].rating);
  assert.ok(ratings.get(2)!.rd > of(2)[0].rd);
});

test("players that no longer exist are left out of a round", () => {
  const {history} = replaySeason([1, 3], [round("2026-01-08", [1, 99], [3], [[1001, 0]])]);
  assert.deepEqual(history.map((h) => h.playerId).sort(), [1, 3]);
});
