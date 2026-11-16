// The admin's Večer lige on the phone (admin-mobile 01): how the night is going and which night's rounds wait to be
// published. Framework free so it can be unit tested.

import {count, NOUN, plural} from "./text";

// A league's round (all its tables) as the admin's Kola list gives it (LeagueRoundSummary); slot: its place on a
// two-place night (null: one place)
type RoundStatusName = "draft" | "approved" | "played" | "live" | "new";
type RoundSummary = {date: string; status: RoundStatusName; slot?: number | null};

// The night Skica shows and how many of its rounds wait (approved: approved and not published yet)
export type DraftNightTab = {date: string; waiting: number; approved: number};

const waitingStatus = (s: RoundSummary["status"]) => s === "draft" || s === "approved";

// The night for Skica: `shown` (the night just created, or ?date=) while the league has rounds that night, else the
// latest night with rounds not published yet; null for none. slot: one place of a two-place night only (its own
// Skica; a one-place night's rounds count as they are).
export function draftNight(all: RoundSummary[] | null, shown: string | null = null, slot: number | null = null): DraftNightTab | null {
  if (!all) return null;
  const rounds = slot == null ? all : all.filter((r) => r.slot == null || r.slot === slot);
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

// A round of the Kola tab (LeagueRoundSummary's fields that matter here)
type KolaRound = {date: string; slot: number | null; roundNumber: number; letter: string | null; tables: number; status: RoundStatusName};

// A published Kolo of a two-place night, both places' tables together, is as far as the furthest of them got
function mergedStatus(statuses: RoundStatusName[]): RoundStatusName {
  if (statuses.every((s) => s === "played")) return "played";
  return statuses.some((s) => s === "live" || s === "played") ? "live" : "new";
}

// The Kola tab's rows (LOCATIONS_PLAN.md, decision 15): a published Kolo of a two-place night is one row with both
// places' tables (slot null: Obriši takes it away at both), as on a one-place night; a Skica not published yet stays a
// row of its place. In the server's order (newest night and Kolo first).
export function kolaRows<T extends KolaRound>(rounds: T[]): T[] {
  const rows: T[] = [];
  const merged = new Map<string, T[]>();
  for (const r of rounds) {
    if (r.slot == null || waitingStatus(r.status)) {
      rows.push(r);
      continue;
    }
    const key = `${r.date}|${r.roundNumber}`;
    if (!merged.has(key)) {
      merged.set(key, []);
      rows.push(r);
    }
    merged.get(key)!.push(r);
  }
  return rows.map((r) => {
    const group = r.slot == null || waitingStatus(r.status) ? null : merged.get(`${r.date}|${r.roundNumber}`)!;
    if (!group || group.length === 1) return r;
    return {...r, slot: null, tables: group.reduce((n, g) => n + g.tables, 0), status: mergedStatus(group.map((g) => g.status))};
  });
}

// Whether a round of the server's list is part of a row of the Kola tab (deleting the row takes it away)
export function inKolaRow(row: KolaRound, round: KolaRound): boolean {
  if (round.date !== row.date || round.roundNumber !== row.roundNumber) return false;
  return row.slot == null ? round.slot == null || !waitingStatus(round.status) : round.slot === row.slot && waitingStatus(round.status) === waitingStatus(row.status);
}

// How one place of a two-place night is doing, for its place picker (Claude Design 06 A, 07 A): "skica čeka", "kolo 7
// u tijeku" (live: the red dot), "kolo 7 objavljeno", "kolo 8 odigrano" or "još nema kola"; short: the phone's switch
// ("skica", "kolo 7", "bez kola")
export function placeStatus(
  rounds: {date: string; slot?: number | null; roundNumber: number; status: RoundStatusName}[],
  date: string,
  slot: number
): {text: string; short: string; live: boolean} {
  const mine = rounds.filter((r) => r.date === date && r.slot === slot);
  if (mine.some((r) => waitingStatus(r.status))) return {text: "skica čeka", short: "skica", live: false};
  const out = mine.sort((a, b) => a.roundNumber - b.roundNumber);
  if (out.length === 0) return {text: "još nema kola", short: "bez kola", live: false};
  const live = out.find((r) => r.status === "live");
  if (live) return {text: `kolo ${live.roundNumber} u tijeku`, short: `kolo ${live.roundNumber}`, live: true};
  const next = out.find((r) => r.status === "new");
  if (next) return {text: `kolo ${next.roundNumber} objavljeno`, short: `kolo ${next.roundNumber}`, live: false};
  const last = out[out.length - 1].roundNumber;
  return {text: `kolo ${last} odigrano`, short: `kolo ${last}`, live: false};
}

// Tonight's rounds already published (played, being played or not started yet): how many, how many are being played,
// and the number the next new round gets (published rounds keep their numbers; Skica's letters don't count). null: none.
// slot: one place of a two-place night, which numbers its own Kola on the night's shared numbers (Kartaš 7, 8, 9 and
// Lanterna 7, 8), as draftNight counts its own Skica.
export type PublishedTonight = {published: number; live: number; next: number};

export function publishedTonight(rounds: (RoundSummary & {roundNumber: number})[] | null, date: string, slot: number | null = null): PublishedTonight | null {
  const night = (rounds ?? []).filter((r) => r.date === date && !waitingStatus(r.status) && (slot == null || r.slot == null || r.slot === slot));
  if (night.length === 0) return null;
  return {published: night.length, live: night.filter((r) => r.status === "live").length, next: Math.max(...night.map((r) => r.roundNumber)) + 1};
}

// "Večeras su već objavljena 3 kola (1 u tijeku)"
export function publishedLabel({published, live}: PublishedTonight): string {
  const verb = plural(published, "je već objavljeno", "su već objavljena", "je već objavljeno");
  return `Večeras ${verb} ${count(published, NOUN.kolo)}${live > 0 ? ` (${live} u tijeku)` : ""}`;
}

// The new rounds on the create button: "Kolo 4" or "Kolo 4–6"
export function newRoundsLabel(next: number, rounds: number): string {
  return rounds > 1 ? `Kolo ${next}–${next + rounds - 1}` : `Kolo ${next}`;
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

// One place of tonight's two-place night on the admin's Večer (Claude Design 11 A): how its Kola go (its own Kolo
// numbers, its own tables) and how many of its rounds wait in Skica. kolo: which of the place's Kola tonight is being
// played, and how many it has (Skice too): "kolo 2 od 3"; null while none is. kola: how many Kola the place has tonight
// ("3 / 3 kola odigrano").
export type PlaceTonight = {slot: 1 | 2; state: TonightState; waiting: number; approved: number; kolo: [number, number] | null; kola: number};

// Both places of tonight: tables are tonight's published tables with their place; rounds are the league's Kola list
// (a row per place, drafts too)
export function placesTonight(
  tables: (TonightTable & {slot: number | null})[],
  rounds: {date: string; slot?: number | null; roundNumber: number; status: RoundStatusName}[],
  tonight: string
): PlaceTonight[] {
  return ([1, 2] as const).map((slot) => {
    const mine = rounds.filter((r) => r.date === tonight && r.slot === slot);
    const draft = draftNight(mine, tonight);
    const numbers = Array.from(new Set(mine.map((r) => r.roundNumber))).sort((a, b) => a - b);
    const state = tonightState(
      tables.filter((t) => t.slot === slot),
      numbers.length
    );
    const at = state.kind === "playing" ? numbers.indexOf(state.round) : -1;
    return {
      slot,
      state,
      waiting: draft?.waiting ?? 0,
      approved: draft?.approved ?? 0,
      kolo: at >= 0 ? [at + 1, numbers.length] : null,
      kola: numbers.length,
    };
  });
}

// The eyebrow of the night card: "Kolo 2 od 3 · u tijeku"
export function tonightEyebrow(state: Extract<TonightState, {kind: "playing"}>): string {
  return `Kolo ${state.round} od ${state.rounds} · ${state.started ? "u tijeku" : "nije počelo"}`;
}
