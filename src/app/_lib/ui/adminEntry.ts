import {AdminHand, PadHand} from "@/app/_interfaces/adminHand";
import {canAddZvanje, CUSTOM_HAND_MAX, HAND_POINTS, handError, NO_ZVANJA, Side, Zvanje, zvanjaError, ZvanjaCounts, zvanjaPoints} from "@/app/_lib/game/scoring";

// Hand entry on the admin scorepad. Kept in local state (not the players' persisted stores), so an admin editing
// a table never touches a hand a player is entering on the same device.
//   std: a normal hand, each team's zvanja clicked, the typed team's points and the rest of 11 to the other team
//   man: a custom hand ("Custom"), each team's points typed on their own, without zvanja (the points are the total)
// The mode names are the Bela app's, which the Daily table page (shared with it) passes around.

export type EntryState = {
  mode: "std" | "man";
  active: Side;
  points: [number, number];
  // the next digit starts a new number (after switching team or opening a hand)
  fresh: boolean;
  // each team's zvanja, by value
  zvanja: Record<Side, ZvanjaCounts>;
};

const noZvanja = (): Record<Side, ZvanjaCounts> => ({1: {...NO_ZVANJA}, 2: {...NO_ZVANJA}});

export function blankEntry(mode: EntryState["mode"] = "std"): EntryState {
  return {mode, active: 1, points: [0, 0], fresh: true, zvanja: noZvanja()};
}

const idx = (side: Side) => side - 1;

export function typeDigit(s: EntryState, digit: number): EntryState {
  const i = idx(s.active);
  const value = (s.fresh ? 0 : s.points[i]) * 10 + digit;
  if (s.mode === "man") {
    if (value > CUSTOM_HAND_MAX) return s;
    const points: [number, number] = [...s.points];
    points[i] = value;
    return {...s, points, fresh: false};
  }
  if (value > HAND_POINTS) return s;
  const points: [number, number] = [0, 0];
  points[i] = value;
  points[1 - i] = HAND_POINTS - value;
  return {...s, points, fresh: false};
}

export const setActive = (s: EntryState, side: Side): EntryState => ({...s, active: side, fresh: true});
export const clearPoints = (s: EntryState): EntryState => ({...s, points: [0, 0], fresh: true});

// One more zvanje of the value for the active team, when the cards still allow it
export function addZvanje(s: EntryState, v: Zvanje): EntryState {
  if (!canAddZvanjeTo(s, v)) return s;
  const team = s.zvanja[s.active];
  return {...s, zvanja: {...s.zvanja, [s.active]: {...team, [v]: team[v] + 1}}};
}

export const canAddZvanjeTo = (s: EntryState, v: Zvanje): boolean => canAddZvanje(s.zvanja[1], s.zvanja[2], s.active, v);

// Obriši zvanja: the active team's
export const clearZvanja = (s: EntryState): EntryState => ({...s, zvanja: {...s.zvanja, [s.active]: {...NO_ZVANJA}}});

// each team's zvanja points, for the team boxes
export const entryZvanjaPoints = (s: EntryState): [number, number] => [zvanjaPoints(s.zvanja[1]), zvanjaPoints(s.zvanja[2])];

// Switching between normal and custom entry keeps the points typed so far; the zvanja go, a custom hand has none
export const switchMode = (s: EntryState, mode: EntryState["mode"]): EntryState =>
  mode === s.mode ? s : {...s, mode, fresh: true, zvanja: noZvanja()};

// declarations false: the table is a tournament's "bez zvanja"
export const canSave = (s: EntryState, declarations = true): boolean =>
  handError(s.points[0], s.points[1], s.mode === "man") === null &&
  zvanjaError(s.zvanja[1], s.zvanja[2], {custom: s.mode === "man", declarations}) === null;

// A custom hand goes without zvanja (the server stores none)
export function toAdminHand(s: EntryState): AdminHand {
  if (s.mode === "man") return {custom: true, points1: s.points[0], points2: s.points[1]};
  return {custom: false, points1: s.points[0], points2: s.points[1], zvanja1: s.zvanja[1], zvanja2: s.zvanja[2]};
}

// A saved hand opened for editing: its points and its zvanja
export function fromPadHand(h: PadHand): EntryState {
  return {...blankEntry(h.custom ? "man" : "std"), points: [h.points1, h.points2], zvanja: {1: {...h.zvanja1}, 2: {...h.zvanja2}}};
}

// Custom on the admin's phone (Bela's Ručni unos): each team's points as typed, 0 to CUSTOM_HAND_MAX. bad: a field
// holds something that isn't such a number ("Upiši broj od 0 do 99."); points: both fields are numbers and at least one
// isn't 0, so the hand can be saved.
export function manualFields(a: string, b: string): {bad: boolean; points: [number, number] | null} {
  const ok = (v: string) => /^\d{1,2}$/.test(v) && Number(v) <= CUSTOM_HAND_MAX;
  const bad = (a !== "" && !ok(a)) || (b !== "" && !ok(b));
  const points: [number, number] | null = ok(a) && ok(b) && Number(a) + Number(b) > 0 ? [Number(a), Number(b)] : null;
  return {bad, points};
}
