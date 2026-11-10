import assert from "node:assert/strict";
import {test} from "node:test";
import {
  EntryState,
  addZvanje,
  blankEntry,
  canAddZvanjeTo,
  canSave,
  clearPoints,
  clearZvanja,
  entryZvanjaPoints,
  fromPadHand,
  setActive,
  switchMode,
  toAdminHand,
  typeDigit,
} from "../ui/adminEntry";
import {normalizeResult} from "../validation/validateResult";
import {NO_ZVANJA} from "../game/scoring";

// The admin scorepad's hand entry (normal and custom)

const type = (s: EntryState, digits: string) => digits.split("").reduce((acc, d) => typeDigit(acc, Number(d)), s);

test("normal entry gives the other team the rest of 11 and stops at 11", () => {
  let s = type(blankEntry(), "8");
  assert.deepEqual(s.points, [8, 3]);
  s = type(setActive(s, 2), "12");
  assert.deepEqual(s.points, [10, 1]);
});

test("custom entry types each team on its own, up to 99", () => {
  let s = type(blankEntry("man"), "14");
  s = type(setActive(s, 2), "3");
  assert.deepEqual(s.points, [14, 3]);
  s = type(s, "99"); // 399 is too much
  assert.deepEqual(s.points, [14, 39]);
  assert.equal(canSave(s), true);
  assert.deepEqual(toAdminHand(s), {custom: true, points1: 14, points2: 39});
});

test("a hand can be saved once its points follow the rules", () => {
  assert.equal(canSave(blankEntry()), false);
  assert.equal(canSave(blankEntry("man")), false);
  const s = type(blankEntry(), "6");
  assert.equal(canSave(s), true);
  assert.equal(canSave(clearPoints(s)), false);
  // custom points that don't add up to 11 can't be saved as a normal hand
  assert.equal(canSave(switchMode(type(blankEntry("man"), "14"), "std")), false);
});

test("switching mode keeps the points; the next digit starts a new number", () => {
  let s = type(blankEntry(), "7");
  s = switchMode(s, "man");
  assert.deepEqual(s.points, [7, 4]);
  s = type(s, "2");
  assert.deepEqual(s.points, [2, 4]);
});

test("whatever the scorepad lets an admin save, the server accepts, and the other way round", () => {
  for (const mode of ["std", "man"] as const) {
    for (let a = 0; a <= 15; a++) {
      for (let b = 0; b <= 15; b++) {
        const s: EntryState = {...blankEntry(mode), points: [a, b]};
        const hand = toAdminHand(s);
        const request = {match_id: 1, team1_game_points: hand.points1, team2_game_points: hand.points2, custom: hand.custom};
        let accepted = true;
        try {
          normalizeResult(request);
        } catch {
          accepted = false;
        }
        assert.equal(accepted, canSave(s), `${mode} ${a}:${b}`);
      }
    }
  }
});

test("a saved hand opens with its points, a custom one as custom", () => {
  const std = fromPadHand({id: 1, total1: 7, total2: 4, points1: 7, points2: 4, zvanja1: NO_ZVANJA, zvanja2: NO_ZVANJA, custom: false, dosta: null});
  assert.equal(std.mode, "std");
  assert.deepEqual(std.points, [7, 4]);
  assert.equal(std.fresh, true);

  const custom = fromPadHand({id: 2, total1: 14, total2: 3, points1: 14, points2: 3, zvanja1: NO_ZVANJA, zvanja2: NO_ZVANJA, custom: true, dosta: 1});
  assert.equal(custom.mode, "man");
  assert.deepEqual(custom.points, [14, 3]);
});

// Natrag na kolo (Bela's tableScope test, with the league's table path)
test("the scorepad goes Back to its round, or by its address after a reload at the table", async () => {
  const {roundBackBy} = await import("../ui/tableScope");
  const table = "/league/2/daily-standings/table/42";
  assert.equal(roundBackBy("/league/2/daily-standings", table, 3), "back");
  assert.equal(roundBackBy("/", table, 5), "back");
  assert.equal(roundBackBy(table, table, 6), "address");
  assert.equal(roundBackBy(null, table, 1), "address");
  assert.equal(roundBackBy("/league/2/daily-standings", table, 1), "address");
  assert.equal(roundBackBy("/league/2/daily-standings/table/41", table, 4), "back");
});

// ---------- zvanja ----------

test("zvanja: a click a zvanje for the active team, Obriši zvanja for that team only, nothing the cards can't make", () => {
  let s = blankEntry();
  s = addZvanje(s, 3);
  s = addZvanje(s, 4);
  s = setActive(s, 2);
  s = addZvanje(s, 3);
  assert.deepEqual(s.zvanja, {1: {3: 1, 4: 1}, 2: {3: 1, 4: 0}});
  assert.deepEqual(entryZvanjaPoints(s), [7, 3]);
  // 1 × 3 + 1 × 4 against 1 × 4 can't happen: the click is ignored and the button is off
  assert.equal(canAddZvanjeTo(s, 4), false);
  assert.deepEqual(addZvanje(s, 4), s);
  s = clearZvanja(s);
  assert.deepEqual(s.zvanja, {1: {3: 1, 4: 1}, 2: {3: 0, 4: 0}});
});

test("a hand with zvanja goes to the server with them, and opens again with its points and zvanja", () => {
  let s = addZvanje(addZvanje(blankEntry(), 3), 3);
  s = typeDigit(s, 6);
  assert.equal(canSave(s), true);
  const hand = toAdminHand(s);
  assert.deepEqual(hand, {custom: false, points1: 6, points2: 5, zvanja1: {3: 2, 4: 0}, zvanja2: {3: 0, 4: 0}});
  // what the server makes of it, and the hand it lists: totals 12 : 5
  assert.deepEqual(normalizeResult({match_id: 1, team1_game_points: 6, team2_game_points: 5, team1_zvanja3: 2, custom: false}).team1_zvanja3, 2);
  const opened = fromPadHand({id: 3, total1: 12, total2: 5, points1: 6, points2: 5, zvanja1: {3: 2, 4: 0}, zvanja2: NO_ZVANJA, custom: false, dosta: null});
  assert.deepEqual([opened.points, opened.zvanja], [[6, 5], {1: {3: 2, 4: 0}, 2: {3: 0, 4: 0}}]);
});

test("Ručni unos drops the zvanja, and a table bez zvanja takes none", () => {
  const s = typeDigit(addZvanje(blankEntry(), 4), 6);
  const manual = switchMode(s, "man");
  assert.deepEqual(manual.zvanja, {1: {3: 0, 4: 0}, 2: {3: 0, 4: 0}});
  assert.equal(toAdminHand({...s, mode: "man"}).zvanja1, undefined);
  assert.equal(canSave(s, false), false);
  assert.equal(canSave(clearZvanja(s), false), true);
});
