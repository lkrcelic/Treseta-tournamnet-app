import assert from "node:assert/strict";
import {test} from "node:test";
import {matchState, MATCH_THRESHOLD} from "../game/scoring";
import {lostWinnerError} from "../service/admin/hands";

// The admin scorepad's change of a finished match's hands: the match may change hands, but a match that had a winner
// is never left without one (the round would read 0:0 and count a draw). The database side is in
// db/finishedMatchEdit.test.ts (npm run test:db). Treseta's matches: to 41, raised by 10 while level at or above it.

const hand = (a: number, b: number) => ({team1_game_points: a, team2_game_points: b, custom: true, dosta_side: null});
const state = (...hands: [number, number][]) => matchState(hands.map(([a, b]) => hand(a, b)), MATCH_THRESHOLD);

test("deleting a hand that takes the winner below 41 is refused", () => {
  const error = lostWinnerError(1, state([30, 20]));
  assert.equal(error, "Meč bi ostao bez pobjednika (30:20, nitko nema 41). Ispravi bodove tako da jedna ekipa i dalje pobjeđuje.");
});

test("an edit that levels the score is refused", () => {
  assert.match(lostWinnerError(1, state([41, 41])) ?? "", /\(41:41\)/);
  assert.match(lostWinnerError(2, state([30, 30])) ?? "", /\(30:30\)/);
});

test("an edit that keeps a winner, or moves the win to the other team, is allowed", () => {
  assert.equal(lostWinnerError(1, state([41, 20])), null);
  assert.equal(lostWinnerError(1, state([20, 41])), null);
});

test("a match that already had no winner can still be corrected", () => {
  assert.equal(lostWinnerError(null, state([30, 20])), null);
  assert.equal(lostWinnerError(null, state([41, 20])), null);
});
