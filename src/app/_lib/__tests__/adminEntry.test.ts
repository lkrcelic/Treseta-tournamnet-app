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
  dostaAskHand,
  entryZvanjaPoints,
  fromPadHand,
  handPlace,
  levelAtTarget,
  setActive,
  switchMode,
  toAdminHand,
  typeDigit,
} from "../ui/adminEntry";
import {normalizeResult} from "../validation/validateResult";
import {matchState, NO_ZVANJA} from "../game/scoring";
import {padPlayedHands} from "../tableOverview";
import {PadHand} from "../../_interfaces/adminHand";

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

test("na prolaz: the board's flag for a level score at or above the target", () => {
  const m = {score1: 44, score2: 44, threshold: 41, winner: null};
  assert.equal(levelAtTarget({matchEnd: "NA_PROLAZ"}, m), true);
  assert.equal(levelAtTarget({matchEnd: "S_OVIM_DOSTA"}, m), false);
  assert.equal(levelAtTarget({matchEnd: "NA_PROLAZ"}, {...m, score1: 30, score2: 30}), false);
});

// a hand on the scorepad: its id, its totals, custom and its call
const padHand = (id: number, [total1, total2]: [number, number], custom = false, dosta: 1 | 2 | null = null): PadHand =>
  ({id, total1, total2, points1: total1, points2: total2, zvanja1: NO_ZVANJA, zvanja2: NO_ZVANJA, custom, dosta});
// a match's score and winner, replayed from its hands by the rules
const pick = (s: {score1: number; score2: number; winner: 1 | 2 | null}) => ({score: [s.score1, s.score2], winner: s.winner});

test("\"s ovim dosta\" is asked about the custom hand just saved when it is the match's last: added, or corrected", () => {
  const hands = [padHand(1, [8, 3]), padHand(2, [3, 8]), padHand(3, [6, 5], true)];
  assert.equal(dostaAskHand(hands, null)?.id, 3);
  assert.equal(dostaAskHand(hands, 3)?.id, 3);
  // an earlier hand corrected, even while the last hand is custom without a call: nothing to ask
  assert.equal(dostaAskHand(hands, 2), null);
  assert.equal(dostaAskHand([...hands, padHand(4, [8, 3])], 3), null);
  // a last hand that is no custom one, or already has its call: nothing to ask
  assert.equal(dostaAskHand([...hands.slice(0, 2), padHand(3, [6, 5])], null), null);
  assert.equal(dostaAskHand([...hands.slice(0, 2), padHand(3, [6, 5], true, 1)], 3), null);
  assert.equal(dostaAskHand([], null), null);
});

test("a correction that puts a won match back in play still asks \"s ovim dosta\": the corrected hand is at its place, with a new id", () => {
  // Treseta #1: Meč 1 won 41 : 43 by team 1's call in Igra 8, a custom 6 : 5
  const played: [number, number][] = [[8, 3], [3, 8], [8, 3], [3, 8], [6, 5], [5, 6]];
  const won = [...played.map((p, i) => padHand(i + 1, p)), padHand(7, [2, 5], true), padHand(8, [6, 5], true, 1)];
  assert.deepEqual(pick(matchState(padPlayedHands({hands: won}))), {score: [41, 43], winner: 1});
  // the admin corrects Igra 8 to a custom 6 : 3 without the call: 41 : 41, no winner, so the match goes back in play
  // with its eight hands copied in their order, with new ids (101 … 108)
  const reopened = [...won.slice(0, 7).map((h) => ({...h, id: h.id + 100})), padHand(108, [6, 3], true)];
  assert.deepEqual(pick(matchState(padPlayedHands({hands: reopened}))), {score: [41, 41], winner: null});
  const corrected = handPlace(won, 8);
  assert.equal(corrected, 8);
  assert.equal(dostaAskHand(reopened, corrected)?.id, 108);
});

test("a hand's place is its number in the match, 1 for the first; a hand not in the match has none", () => {
  const hands = [padHand(11, [8, 3]), padHand(12, [3, 8]), padHand(13, [6, 5], true)];
  assert.equal(handPlace(hands, 11), 1);
  assert.equal(handPlace(hands, 13), 3);
  assert.equal(handPlace(hands, 99), 0);
  // a correction of a hand that is no longer in the match asks nothing
  assert.equal(dostaAskHand(hands, handPlace(hands, 99)), null);
});
