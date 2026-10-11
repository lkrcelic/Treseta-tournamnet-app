import assert from "node:assert/strict";
import {test} from "node:test";
import {ResultCreateRequest} from "@/app/_interfaces/result";
import {normalizeResult} from "@/app/_lib/validation/validateResult";

// What the server does with a hand before saving it: check it against the rules

const hand = (overrides: Partial<ResultCreateRequest> = {}): ResultCreateRequest => ({
  match_id: 1,
  team1_game_points: 7,
  team2_game_points: 4,
  custom: false,
  ...overrides,
});

// matched by name: the tests compile to an ES5 target, where instanceof doesn't work for Error subclasses
const InvalidResultError = {name: "InvalidResultError"};

test("a correct hand is kept as it is", () => {
  assert.deepEqual(normalizeResult(hand()), hand());
});

test("a hand sent without the custom flag is a normal hand", () => {
  const {custom: _custom, ...withoutFlag} = hand();
  void _custom;
  assert.equal(normalizeResult(withoutFlag as ResultCreateRequest).custom, false);
});

test("a custom hand keeps both teams' points and its flag", () => {
  const saved = normalizeResult(hand({team1_game_points: 14, team2_game_points: 3, custom: true}));
  assert.deepEqual([saved.team1_game_points, saved.team2_game_points, saved.custom], [14, 3, true]);
});

test("points that can't happen are refused", () => {
  const cases: Partial<ResultCreateRequest>[] = [
    {team1_game_points: 14, team2_game_points: 3}, // a normal hand over 11 (a tampered or outdated client)
    {team1_game_points: 5, team2_game_points: 5}, // under 11
    {team1_game_points: 0, team2_game_points: 0}, // nothing entered
    {team1_game_points: 0, team2_game_points: 0, custom: true},
    {team1_game_points: -2, team2_game_points: 13}, // negative
    {team1_game_points: 100, team2_game_points: 0, custom: true}, // over the custom limit
  ];
  for (const c of cases) {
    assert.throws(() => normalizeResult(hand(c)), InvalidResultError, JSON.stringify(c));
  }
});
