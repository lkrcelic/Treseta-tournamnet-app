// The admin's Večer lige on the phone (admin-mobile 01): how the night is going and which night's rounds wait to be
// published. Framework free so it can be unit tested.

import {count, NOUN, plural} from "./text";

// A league's round (all its tables) as the admin's Kola list gives it (LeagueRoundSummary)
type RoundSummary = {date: string; status: "draft" | "approved" | "played" | "live" | "new"};

// The night Skica shows and how many of its rounds wait (approved: approved and not published yet)
export type DraftNightTab = {date: string; waiting: number; approved: number};

const waitingStatus = (s: RoundSummary["status"]) => s === "draft" || s === "approved";

// The night for Skica: `shown` (the night just created, or ?date=) while the league has rounds that night, else the
// latest night with rounds not published yet; null for none
export function draftNight(rounds: RoundSummary[] | null, shown: string | null = null): DraftNightTab | null {
  if (!rounds) return null;
  const tab = (date: string): DraftNightTab => {
    const night = rounds.filter((r) => r.date === date);
    return {date, waiting: night.filter((r) => waitingStatus(r.status)).length, approved: night.filter((r) => r.status === "approved").length};
  };
  if (shown && rounds.some((r) => r.date === shown)) return tab(shown);
  const latest = rounds
    .filter((r) => waitingStatus(r.status))
    .map((r) => r.date)
    .sort()
    .pop();
  return latest ? tab(latest) : null;
}

// "3 kola nisu objavljena · 1 odobreno" (Skica čeka objavu)
export function waitingLabel(waiting: number, approved: number): string {
  const verb = plural(waiting, "nije objavljeno", "nisu objavljena", "nije objavljeno");
  const main = `${count(waiting, NOUN.kolo)} ${verb}`;
  return approved > 0 ? `${main} · ${approved} ${plural(approved, "odobreno", "odobrena", "odobreno")}` : main;
}

// One table of tonight's published rounds (toTableRows' fields that matter here)
export type TonightTable = {round: number; done: boolean; started: boolean; bye: boolean};

export type TonightState =
  // no published round tonight
  | {kind: "none"}
  // the first round with a table still open: `done` of its `tables` are finished; started: a match was played or is
  // being played at one of them
  | {kind: "playing"; round: number; rounds: number; done: number; tables: number; started: boolean}
  // every published round is finished
  | {kind: "finished"; rounds: number};

// How tonight is going. rounds: how many rounds the night has, unpublished ones too (Kolo 2 od 3).
export function tonightState(tables: TonightTable[], rounds = 0): TonightState {
  const numbers = Array.from(new Set(tables.map((t) => t.round))).sort((a, b) => a - b);
  if (numbers.length === 0) return {kind: "none"};
  const all = Math.max(rounds, numbers[numbers.length - 1]);
  const current = numbers.find((n) => tables.some((t) => t.round === n && !t.done));
  if (current == null) return {kind: "finished", rounds: all};
  const round = tables.filter((t) => t.round === current);
  return {
    kind: "playing",
    round: current,
    rounds: all,
    done: round.filter((t) => t.done).length,
    tables: round.length,
    started: round.some((t) => !t.bye && (t.started || t.done)),
  };
}

// The eyebrow of the night card: "Kolo 2 od 3 · u tijeku"
export function tonightEyebrow(state: Extract<TonightState, {kind: "playing"}>): string {
  return `Kolo ${state.round} od ${state.rounds} · ${state.started ? "u tijeku" : "nije počelo"}`;
}
