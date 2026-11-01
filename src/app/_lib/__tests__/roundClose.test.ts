import assert from "node:assert/strict";
import {test} from "node:test";
import {MATCHES_PER_ROUND, roundAfterMatch, roundWinsIncrement} from "../service/round/finish";

// Završi meč: the winner's side gets one more won match, and the round closes once its matches are played (two), else the next match opens. The SQL side (update_team_score) is covered by
// db/roundClose.test.ts (npm run test:db).

test("the winner's side counts one more won match", () => {
  assert.deepEqual(roundWinsIncrement(1), {team1_wins: {increment: 1}});
  assert.deepEqual(roundWinsIncrement(2), {team2_wins: {increment: 1}});
});

test("a league round plays two matches: after the first the next opens, after the second it closes", () => {
  assert.equal(MATCHES_PER_ROUND, 2);
  assert.equal(roundAfterMatch(1, MATCHES_PER_ROUND), "next");
  assert.equal(roundAfterMatch(2, MATCHES_PER_ROUND), "close");
});

test("a 1:1 round still closes after its second match (a draw)", () => {
  // the winners are 1 then 2: the decision depends only on how many matches were played
  assert.equal(roundAfterMatch(2, 2), "close");
});

test("more matches than the round plays (a retried tap) never opens another", () => {
  assert.equal(roundAfterMatch(3, 2), "close");
  assert.equal(roundAfterMatch(0, 2), "next");
});
