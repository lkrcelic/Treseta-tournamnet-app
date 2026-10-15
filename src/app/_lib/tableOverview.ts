import type {OverviewMatch, TableOverview, TablePad} from "@/app/_interfaces/adminHand";

// A table's two matches as Pregled stola and the admin's phone scorepad show them (Meč 1 · Meč 2)

export const TABLE_MATCHES = 2;

// The table as anyone signed in may see it: each hand's totals, nothing about who called or what was announced
export function toTableOverview(pad: TablePad): TableOverview {
  const {hasLineup: _lineup, matches, ...rest} = pad;
  void _lineup;
  return {
    ...rest,
    matches: matches.map(({hands, ...m}) => ({...m, hands: hands.map((h) => ({id: h.id, total1: h.total1, total2: h.total2}))})),
  };
}

export type TableState = "live" | "done" | "new";

// Uživo once a hand is entered or a match is finished, Završeno once the round is closed
export function tableState(t: {done: boolean; matches: {kind: string; hands: unknown[]}[]}): TableState {
  if (t.done) return "done";
  return t.matches.some((m) => m.kind === "finished" || m.hands.length > 0) ? "live" : "new";
}

export type MatchSlotState = "done" | "live" | "new";

export type MatchSlot<M> = {number: number; state: MatchSlotState; match: M | null};

// Meč 1 and Meč 2, played, being played or not started yet. A match running without a hand yet is "new".
export function matchSlots<M extends Pick<OverviewMatch, "number" | "kind" | "hands">>(matches: M[]): MatchSlot<M>[] {
  return Array.from({length: TABLE_MATCHES}, (_, i) => {
    const m = matches.find((x) => x.number === i + 1) ?? null;
    const state: MatchSlotState = !m ? "new" : m.kind === "finished" ? "done" : m.hands.length ? "live" : "new";
    return {number: i + 1, state, match: m};
  });
}

// The match a table opens on: the one being played, otherwise the last one played, otherwise Meč 1
export function currentMatchNumber(matches: Pick<OverviewMatch, "number" | "kind">[]): number {
  const ongoing = matches.find((m) => m.kind === "ongoing");
  if (ongoing) return ongoing.number;
  return matches.length ? Math.min(TABLE_MATCHES, matches[matches.length - 1].number) : 1;
}

// Matches each team won in the round
export function roundWins(matches: Pick<OverviewMatch, "kind" | "winner">[]): [number, number] {
  const wins: [number, number] = [0, 0];
  for (const m of matches) if (m.kind === "finished" && m.winner) wins[m.winner - 1]++;
  return wins;
}

// What a match stands at under its name in Meč 1 · Meč 2. Pregled stola names the winner of a played match and
// shows the points of the one running ("1034 : 748 · Purgeri", "u tijeku · 312 : 480"); the admin's scorepad,
// whose boards show the points, says only "1196 : 746 · završen" and "u tijeku".
export function matchTabSub(
  slot: MatchSlot<Pick<OverviewMatch, "score1" | "score2" | "winner">>,
  names: [string, string],
  style: "pregled" | "admin"
): string {
  const m = slot.match;
  if (slot.state === "new" || !m) return "nije počeo";
  const score = `${m.score1} : ${m.score2}`;
  if (slot.state === "live") return style === "admin" ? "u tijeku" : `u tijeku · ${score}`;
  if (style === "admin") return `${score} · završen`;
  return m.winner ? `${score} · ${names[m.winner - 1]}` : score;
}
