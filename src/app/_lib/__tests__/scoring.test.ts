import {test} from "node:test";
import assert from "node:assert/strict";
import {CUSTOM_HAND_MAX, HAND_POINTS, handError, MATCH_THRESHOLD, matchWinner} from "@/app/_lib/game/scoring";

test("the rules: 11 points a hand, matches to 41", () => {
  assert.equal(HAND_POINTS, 11);
  assert.equal(MATCH_THRESHOLD, 41);
  assert.equal(CUSTOM_HAND_MAX, 99);
});

test("a normal hand splits 11 between the teams", () => {
  assert.equal(handError(6, 5, false), null);
  assert.equal(handError(11, 0, false), null);
  assert.equal(handError(0, 11, false), null);
});

test("a normal hand that doesn't add up to 11 is refused", () => {
  assert.match(handError(6, 6, false)!, /add up to 11/);
  assert.match(handError(14, 3, false)!, /add up to 11/);
  assert.match(handError(5, 0, false)!, /add up to 11/);
});

test("a custom hand is typed freely for each team, up to the limit", () => {
  assert.equal(handError(14, 3, true), null);
  assert.equal(handError(0, 4, true), null);
  assert.equal(handError(6, 5, true), null);
  assert.equal(handError(99, 99, true), null);
  assert.match(handError(100, 0, true)!, /more than 99/);
});

test("points can't be negative, fractional or both zero", () => {
  for (const custom of [false, true]) {
    assert.match(handError(12, -1, custom)!, /negative/);
    assert.match(handError(5.5, 5.5, custom)!, /whole numbers/);
    assert.match(handError(0, 0, custom)!, /at least one team/);
  }
});

test("a match is won by the first team to reach 41", () => {
  assert.equal(matchWinner(40, 39, MATCH_THRESHOLD), null);
  assert.equal(matchWinner(41, 30, MATCH_THRESHOLD), 1);
  assert.equal(matchWinner(25, 44, MATCH_THRESHOLD), 2);
});

test("both teams over 41: the higher score wins; a tie plays on", () => {
  assert.equal(matchWinner(43, 48, MATCH_THRESHOLD), 2);
  assert.equal(matchWinner(42, 42, MATCH_THRESHOLD), null);
  assert.equal(matchWinner(0, 0, MATCH_THRESHOLD), null);
});
