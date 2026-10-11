import assert from "node:assert/strict";
import {test} from "node:test";
import {
  blankEntry,
  canSave,
  clearPoints,
  EntryState,
  fromPadHand,
  setActive,
  switchMode,
  toAdminHand,
  typeDigit,
} from "../ui/adminEntry";
import {normalizeResult} from "../validation/validateResult";

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
  const std = fromPadHand({id: 1, total1: 7, total2: 4, custom: false});
  assert.equal(std.mode, "std");
  assert.deepEqual(std.points, [7, 4]);
  assert.equal(std.fresh, true);

  const custom = fromPadHand({id: 2, total1: 14, total2: 3, custom: true});
  assert.equal(custom.mode, "man");
  assert.deepEqual(custom.points, [14, 3]);
});
