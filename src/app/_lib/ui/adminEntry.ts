import {AdminHand, PadHand} from "@/app/_interfaces/adminHand";
import {CUSTOM_HAND_MAX, HAND_POINTS, handError, Side} from "@/app/_lib/game/scoring";

// Hand entry on the admin scorepad. Kept in local state (not the players' persisted stores), so an admin editing
// a table never touches a hand a player is entering on the same device.
//   std: a normal hand, the typed team's points and the rest of 11 to the other team
//   man: a custom hand ("Custom"), each team's points typed on their own
// The mode names are the Bela app's, which the Daily table page (shared with it) passes around.

export type EntryState = {
  mode: "std" | "man";
  active: Side;
  points: [number, number];
  // the next digit starts a new number (after switching team or opening a hand)
  fresh: boolean;
};

export function blankEntry(mode: EntryState["mode"] = "std"): EntryState {
  return {mode, active: 1, points: [0, 0], fresh: true};
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

// Switching between normal and custom entry keeps the points typed so far
export const switchMode = (s: EntryState, mode: EntryState["mode"]): EntryState => (mode === s.mode ? s : {...s, mode, fresh: true});

export const canSave = (s: EntryState): boolean => handError(s.points[0], s.points[1], s.mode === "man") === null;

export function toAdminHand(s: EntryState): AdminHand {
  return {custom: s.mode === "man", points1: s.points[0], points2: s.points[1]};
}

// A saved hand opened for editing
export function fromPadHand(h: PadHand): EntryState {
  return {...blankEntry(h.custom ? "man" : "std"), points: [h.total1, h.total2]};
}
