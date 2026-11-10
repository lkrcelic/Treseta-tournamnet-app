import assert from "node:assert/strict";
import {test} from "node:test";
import {matchState, MATCH_THRESHOLD, NO_HAND_ZVANJA} from "../game/scoring";
import {noWinnerWarning} from "../service/admin/hands";

// The admin scorepad's change of a finished match's hands: the match may change hands freely, but leaving a match that
// had a winner without one (the round then counts it for neither team) needs the admin's confirmation first. The
// database side is in db/finishedMatchEdit.test.ts (npm run test:db). Treseta's matches: to 41, raised by 10 while
// level at or above it.

const hand = (a: number, b: number) => ({team1_game_points: a, team2_game_points: b, ...NO_HAND_ZVANJA, custom: true, dosta_side: null});
const state = (...hands: [number, number][]) => matchState(hands.map(([a, b]) => hand(a, b)), MATCH_THRESHOLD);

test("deleting a hand that takes the winner below 41 asks first", () => {
  const warning = noWinnerWarning(1, state([30, 20]));
  assert.equal(warning, "Nakon ove promjene meč je 30:20 i nitko nema 41, pa se ne broji nijednoj ekipi. Rezultat stola, poredak i rejting ponovno se računaju.");
});

test("an edit that levels the score asks first", () => {
  assert.match(noWinnerWarning(1, state([41, 41])) ?? "", /meč je 41:41, pa/);
  assert.match(noWinnerWarning(2, state([30, 30])) ?? "", /meč je 30:30, pa/);
});

test("an edit that keeps a winner, or moves the win to the other team, doesn't ask", () => {
  assert.equal(noWinnerWarning(1, state([41, 20])), null);
  assert.equal(noWinnerWarning(1, state([20, 41])), null);
});

test("a match that already had no winner can still be corrected", () => {
  assert.equal(noWinnerWarning(null, state([30, 20])), null);
  assert.equal(noWinnerWarning(null, state([41, 20])), null);
});
