import "./helpers/memoryStorage";
import assert from "node:assert/strict";
import {beforeEach, test} from "node:test";
import {ResultResponse} from "@/app/_interfaces/result";
import useResultStore from "@/app/_store/game/resultStore";
import {resetHand} from "./helpers/handEntry";

// The keypad logic behind the scoreboard's hand entry (phone screen and desktop panel)

const result = () => useResultStore.getState();
const points = () => [result().resultData.team1_game_points, result().resultData.team2_game_points];
const type = (digits: string) => {
  for (const d of digits) result().setGamePoints(Number(d));
};
const saved = (data: Partial<ResultResponse>) => ({match_id: 1, result_id: 7, team1_game_points: 0, team2_game_points: 0, custom: false, ...data}) as ResultResponse;

beforeEach(resetHand);

test("typing points for one team gives the other team the rest of 11", () => {
  result().setActiveTeam("team1");
  type("8");
  assert.deepEqual(points(), [8, 3]);

  result().setActiveTeam("team2");
  type("10");
  assert.deepEqual(points(), [1, 10]);
});

test("a digit that would go over 11 is ignored", () => {
  result().setActiveTeam("team1");
  type("1");
  type("2"); // 12
  assert.deepEqual(points(), [1, 10]);
  type("1"); // 11
  assert.deepEqual(points(), [11, 0]);
});

test("after switching team the next digit starts a new number", () => {
  result().setActiveTeam("team1");
  type("8");
  result().setActiveTeam("team2");
  type("5");
  assert.deepEqual(points(), [6, 5]);
});

test("a saved hand opened for editing is replaced by the first digit, not appended to", () => {
  result().setResultData(saved({team1_game_points: 7, team2_game_points: 4}));
  type("9");
  assert.deepEqual(points(), [9, 2]);
});

test("Custom: each team's points are typed on their own", () => {
  result().toggleCustom();
  result().setActiveTeam("team1");
  type("14");
  result().setActiveTeam("team2");
  type("3");
  assert.deepEqual(points(), [14, 3]);
  assert.equal(result().resultData.custom, true);
});

test("Custom stops at 99 points for a team", () => {
  result().toggleCustom();
  result().setActiveTeam("team1");
  type("99");
  type("9");
  assert.deepEqual(points(), [99, 0]);
});

test("switching Custom on or off keeps the points typed so far", () => {
  result().setActiveTeam("team1");
  type("8");
  result().toggleCustom();
  assert.deepEqual(points(), [8, 3]);
  // the next digit starts a new number and leaves the other team's points alone
  type("2");
  assert.deepEqual(points(), [2, 3]);

  result().toggleCustom();
  assert.equal(result().resultData.custom, false);
  type("6"); // back to normal: the other team gets the rest of 11
  assert.deepEqual(points(), [6, 5]);
});

test("a saved custom hand opens with Custom on", () => {
  result().setResultData(saved({team1_game_points: 12, team2_game_points: 4, custom: true}));
  assert.equal(result().resultData.custom, true);
  result().setActiveTeam("team2");
  type("5");
  assert.deepEqual(points(), [12, 5]);
});

test("a hand without the custom flag (stored by an earlier version) is a normal hand", () => {
  result().setResultData({match_id: 1, result_id: 3, team1_game_points: 5, team2_game_points: 6} as ResultResponse);
  assert.equal(result().resultData.custom, false);
});

test("X clears the points and keeps Custom; a new hand starts from scratch", () => {
  result().toggleCustom();
  result().setActiveTeam("team1");
  type("12");
  result().resetScore();
  assert.deepEqual(points(), [0, 0]);
  assert.equal(result().resultData.custom, true);

  result().resetResult();
  assert.deepEqual(points(), [0, 0]);
  assert.equal(result().resultData.custom, false);
  assert.equal(result().resultData.activeTeam, "team1");
});
