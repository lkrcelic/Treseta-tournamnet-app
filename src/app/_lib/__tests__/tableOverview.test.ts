import assert from "node:assert/strict";
import {test} from "node:test";
import {PadMatch, TablePad} from "@/app/_interfaces/adminHand";
import {currentMatchNumber, matchSlots, matchTabSub, roundWins, tableState, toTableOverview} from "@/app/_lib/tableOverview";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {manualFields} from "@/app/_lib/ui/adminEntry";

// Pregled stola and the admin's phone scorepad: what a table and its two matches show

const hand = (id: number, total1: number, total2: number) => ({id, total1, total2, custom: false, dosta: null});

const finished = (number: number, score1: number, score2: number, winner: 1 | 2 | null): PadMatch => ({
  kind: "finished",
  id: 100 + number,
  number,
  score1,
  score2,
  threshold: MATCH_THRESHOLD,
  winner,
  hands: [hand(number * 10, score1, score2)],
});

const pad = (matches: PadMatch[], done = false): TablePad => ({
  roundId: 7,
  leagueId: 1,
  roundNumber: 3,
  date: "2026-02-17",
  table: 4,
  smoking: true,
  team1: {id: 11, name: "Purgeri"},
  team2: {id: 12, name: "Kvarnerci"},
  done,
  bye: false,
  hasLineup: true,
  matches,
});

test("the overview keeps each hand's totals only, and doesn't say whether the lineup is confirmed", () => {
  const o = toTableOverview(pad([finished(1, 41, 30, 1)]));
  assert.deepEqual(o.matches[0].hands, [{id: 10, total1: 41, total2: 30}]);
  assert.equal("hasLineup" in o, false);
  assert.equal(o.smoking, true);
  assert.equal(o.team1.name, "Purgeri");
});

test("a table is new until a hand is entered, live while played, done once closed", () => {
  const running: PadMatch = {kind: "ongoing", id: 9, number: 1, score1: 0, score2: 0, threshold: MATCH_THRESHOLD, winner: null, hands: []};
  assert.equal(tableState({done: false, matches: []}), "new");
  // the lineup is confirmed and the match started, but nothing entered yet
  assert.equal(tableState({done: false, matches: [running]}), "new");
  assert.equal(tableState({done: false, matches: [{...running, hands: [hand(1, 4, 7)]}]}), "live");
  assert.equal(tableState({done: false, matches: [finished(1, 41, 30, 1)]}), "live");
  assert.equal(tableState({done: true, matches: [finished(1, 41, 30, 1), finished(2, 44, 22, 1)]}), "done");
});

test("Meč 1 · Meč 2: played, being played, not started", () => {
  const running: PadMatch = {kind: "ongoing", id: 9, number: 2, score1: 15, score2: 22, threshold: MATCH_THRESHOLD, winner: null, hands: [hand(1, 15, 22)]};
  const slots = matchSlots([finished(1, 30, 41, 2), running]);
  assert.deepEqual(
    slots.map((s) => s.state),
    ["done", "live"]
  );
  const names: [string, string] = ["Slavonci", "Istrani"];
  assert.equal(matchTabSub(slots[0], names, "pregled"), "30 : 41 · Istrani");
  assert.equal(matchTabSub(slots[1], names, "pregled"), "u tijeku · 15 : 22");
  assert.equal(matchTabSub(slots[0], names, "admin"), "30 : 41 · završen");
  assert.equal(matchTabSub(slots[1], names, "admin"), "u tijeku");
  const fresh = matchSlots([]);
  assert.deepEqual(
    fresh.map((s) => [s.number, s.state, matchTabSub(s, names, "pregled")]),
    [
      [1, "new", "nije počeo"],
      [2, "new", "nije počeo"],
    ]
  );
});

test("a table opens on the match being played, else the last one played, else Meč 1", () => {
  assert.equal(currentMatchNumber([]), 1);
  assert.equal(currentMatchNumber([finished(1, 41, 30, 1)]), 1);
  assert.equal(currentMatchNumber([finished(1, 41, 30, 1), {...finished(2, 0, 0, null), kind: "ongoing"}]), 2);
  assert.equal(currentMatchNumber([finished(1, 41, 30, 1), finished(2, 44, 22, 1)]), 2);
});

test("the round's wins count finished matches with a winner", () => {
  assert.deepEqual(roundWins([finished(1, 41, 30, 1), finished(2, 35, 44, 2)]), [1, 1]);
  // a corrected match nobody won any more counts for neither
  assert.deepEqual(roundWins([finished(1, 40, 30, null)]), [0, 0]);
});

test("Custom takes 0–99 for each team, and at least one team's points", () => {
  assert.deepEqual(manualFields("", ""), {bad: false, points: null});
  assert.deepEqual(manualFields("12", ""), {bad: false, points: null});
  assert.deepEqual(manualFields("12", "38"), {bad: false, points: [12, 38]});
  assert.deepEqual(manualFields("0", "0"), {bad: false, points: null});
  assert.deepEqual(manualFields("99", "0"), {bad: false, points: [99, 0]});
  assert.deepEqual(manualFields("100", "0"), {bad: true, points: null});
  assert.deepEqual(manualFields("1.5", "0"), {bad: true, points: null});
});
