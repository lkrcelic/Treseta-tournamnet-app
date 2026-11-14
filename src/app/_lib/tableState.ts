// The admin's status of a tournament's table on the Kola screens (Claude Design "Turniri admin" M7b, "Nedolazak za
// stol" NA1) with its line of explanation. Framework free so it can be unit tested.
import {NO_SHOW_SCORE, noShowStep, noShowTimes} from "@/app/_lib/tournamentDay";
import {clockLabel} from "@/app/_lib/gameTime";

export type TableStateKind = "draft" | "new" | "asking" | "live" | "done" | "no_show" | "time_expired" | "skipped" | "bye";

export type TableState = {
  kind: TableStateKind;
  // the chip: "Novo", "Upit · 1:52", "Uživo", "Gotovo", "Nedolazak", "Vrijeme isteklo", "Preskočen"
  label: string;
  // the line under the table; null for an ordinary one
  note: string | null;
  // asking: when the match is skipped (ISO), for a countdown on the screen
  skip_at?: string;
};

export type StateTable = {
  status: "DRAFT" | "APPROVED" | "PUBLISHED";
  open: boolean;
  bye: boolean;
  published_at: Date | null;
  started: boolean;
  attendance: "PRESENT" | "NO_SHOW" | "SKIPPED" | null;
  attendance_at: Date | null;
  // the admin picked the result (Uredi ishod)
  attendance_by_admin?: boolean;
  // the team that answered and the other one, by name
  answered_by: string | null;
  other: string | null;
  // its matches played, in order; time_expired: closed by Vrijeme partije
  matches: {score1: number; score2: number; time_expired: boolean}[];
  team1: string;
  team2: string;
  // the matches the table plays (1 or 2)
  matches_per_round: number;
  // the table is of today's tournament (the question and the skip only happen on the day)
  today: boolean;
};

export function tableState(t: StateTable, now: Date, gameMinutes: number, clock: (d: Date) => string): TableState {
  if (t.status !== "PUBLISHED") return {kind: "draft", label: "Skica", note: null};
  if (t.bye) return {kind: "bye", label: "Slobodna runda", note: null};
  if (t.attendance === "SKIPPED") {
    return {kind: "skipped", label: "Preskočen", note: `${t.attendance_by_admin ? "Odluka admina: m" : "M"}eč se ne boduje, obje ekipe su isključene.`};
  }
  if (t.attendance === "NO_SHOW" && t.attendance_by_admin) {
    return {kind: "no_show", label: "Dodijeljena pobjeda", note: `Odluka admina: pobjeđuju ${t.answered_by} · ${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} po partiji · ${t.other} isključeni`};
  }
  if (t.attendance === "NO_SHOW") {
    const at = t.attendance_at ? ` u ${clock(t.attendance_at)}` : "";
    return {kind: "no_show", label: "Nedolazak", note: `${t.answered_by} prijavili${at} · ${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} po partiji · ${t.other} isključeni`};
  }
  const expired = t.matches.findIndex((m) => m.time_expired);
  if (expired >= 0) {
    const m = t.matches[expired];
    const winner = m.score1 > m.score2 ? t.team1 : t.team2;
    const which = t.matches_per_round > 1 ? `Partija ${expired + 1}` : "Partija";
    return {kind: "time_expired", label: "Vrijeme isteklo", note: `${which} završena nakon ${gameMinutes} min s upisanim rezultatom. Pobjeđuju ${winner}.`};
  }
  if (!t.open) return {kind: "done", label: "Gotovo", note: null};
  if (t.started) return {kind: "live", label: "Uživo", note: null};
  if (t.today && t.attendance == null && t.published_at) {
    const step = noShowStep(t.published_at, now);
    if (step !== "waiting") {
      const {skip} = noShowTimes(t.published_at);
      return {
        kind: "asking",
        label: `Upit · ${clockLabel(skip.getTime() - now.getTime())}`,
        note: `Igra nije počela. U ${clock(skip)} obje ekipe ispadaju iz turnira.`,
        skip_at: skip.toISOString(),
      };
    }
  }
  return {kind: "new", label: "Novo", note: t.attendance === "PRESENT" ? "Ekipe su za stolom, igra još nije započela." : null};
}
