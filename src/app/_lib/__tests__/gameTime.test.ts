import assert from "node:assert/strict";
import {test} from "node:test";
import {
  clockLabel,
  closesAfterHand,
  closesByTime,
  GAME_MINUTES_DEFAULT,
  handTiming,
  matchDeadline,
  TARGET_RAISE_MINUTES,
  targetRaises,
  timeWinner,
} from "@/app/_lib/gameTime";
import {MATCH_THRESHOLD, matchState, TARGET_RAISE} from "@/app/_lib/game/scoring";

// Vrijeme partije: the deadline, the five minutes a raised target is worth, the hands after the time, and closing a
// match by time

const start = new Date("2026-11-10T19:00:00Z");
const ends = matchDeadline(start, GAME_MINUTES_DEFAULT);
const at = (minutes: number, seconds = 0) => new Date(start.getTime() + minutes * 60_000 + seconds * 1000);

test("a match's time counts from its start, and the default is 45 minutes", () => {
  assert.equal(GAME_MINUTES_DEFAULT, 45);
  assert.equal(ends.toISOString(), "2026-11-10T19:45:00.000Z");
});

test("every raise of the target gives the match five more minutes", () => {
  assert.equal(TARGET_RAISE_MINUTES, 5);
  assert.equal(matchDeadline(start, 45, 1).toISOString(), "2026-11-10T19:50:00.000Z");
  assert.equal(matchDeadline(start, 45, 2).toISOString(), "2026-11-10T19:55:00.000Z");
  // a table with its own minutes counts from those
  assert.equal(matchDeadline(start, 30, 1).toISOString(), "2026-11-10T19:35:00.000Z");
});

test("the raises are counted from the target the hands reached", () => {
  assert.equal(targetRaises(MATCH_THRESHOLD, MATCH_THRESHOLD), 0);
  assert.equal(targetRaises(MATCH_THRESHOLD + TARGET_RAISE, MATCH_THRESHOLD), 1);
  assert.equal(targetRaises(MATCH_THRESHOLD + 2 * TARGET_RAISE, MATCH_THRESHOLD), 2);
  // a target below the threshold can't happen; it counts as no raise rather than taking time away
  assert.equal(targetRaises(MATCH_THRESHOLD - TARGET_RAISE, MATCH_THRESHOLD), 0);
});

test("a match level at 41 plays to 51 and lasts 50 minutes, one level again to 61 lasts 55", () => {
  // four hands of 11: 41:41 is level at the target, so it goes up to 51
  const level = [
    {team1_game_points: 11, team2_game_points: 0},
    {team1_game_points: 0, team2_game_points: 11},
    {team1_game_points: 30, team2_game_points: 30, dosta_side: null},
    {team1_game_points: 0, team2_game_points: 0},
  ];
  const once = matchState(level, MATCH_THRESHOLD);
  assert.equal(once.target, 51);
  assert.equal(matchDeadline(start, GAME_MINUTES_DEFAULT, targetRaises(once.target, MATCH_THRESHOLD)).toISOString(), "2026-11-10T19:50:00.000Z");

  const twice = matchState([...level, {team1_game_points: 10, team2_game_points: 10}], MATCH_THRESHOLD);
  assert.equal(twice.target, 61);
  assert.equal(matchDeadline(start, GAME_MINUTES_DEFAULT, targetRaises(twice.target, MATCH_THRESHOLD)).toISOString(), "2026-11-10T19:55:00.000Z");
});

test("a hand before the time is up is on time; without a limit always", () => {
  assert.equal(handTiming({now: at(44, 59), endsAt: ends, tied: false}), "on_time");
  assert.equal(handTiming({now: at(90), endsAt: null, tied: false}), "on_time");
  // the five minutes of a raised target are the deadline's, so the hand after it is on time again
  assert.equal(handTiming({now: at(47), endsAt: matchDeadline(start, GAME_MINUTES_DEFAULT, 1), tied: false}), "on_time");
});

test("after the time: a hand is refused, even one being entered when it ran out; a level score gets one more hand", () => {
  assert.equal(handTiming({now: at(45, 1), endsAt: ends, tied: false}), "too_late");
  assert.equal(handTiming({now: at(50), endsAt: ends, tied: true}), "extra_hand");
});

test("the extra hand ends the match unless the score is still level", () => {
  assert.equal(closesAfterHand("extra_hand", false), true);
  assert.equal(closesAfterHand("extra_hand", true), false);
  assert.equal(closesAfterHand("on_time", false), false);
});

test("nobody finishing: the match closes by itself as soon as the time is up, not while level", () => {
  assert.equal(closesByTime({now: at(45), endsAt: ends, tied: false}), false);
  assert.equal(closesByTime({now: at(45, 1), endsAt: ends, tied: false}), true);
  assert.equal(closesByTime({now: at(60), endsAt: ends, tied: true}), false);
  assert.equal(closesByTime({now: at(60), endsAt: null, tied: false}), false);
});

test("the team with more points wins a match closed by time", () => {
  assert.equal(timeWinner(38, 31), 1);
  assert.equal(timeWinner(22, 29), 2);
  assert.equal(timeWinner(33, 33), null);
});

test("the scorepad's clock", () => {
  assert.equal(clockLabel(23 * 60_000 + 41_000), "23:41");
  assert.equal(clockLabel(5 * 60_000), "5:00");
  assert.equal(clockLabel(6_500), "0:07");
  assert.equal(clockLabel(-3000), "0:00");
});
