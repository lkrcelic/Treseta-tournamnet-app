import {PadLock} from "@/app/_interfaces/adminHand";
import {NO_SHOW_SCORE} from "@/app/_lib/tournamentDay";

// Why a table is locked, which is what Otključaj partiju undoes (DECISIONS #89). Framework free so it can be unit
// tested: a table answered Nedolazak or Preskočen is locked by that answer whatever else it holds; any other table is
// locked once it is closed with no game running at it, by Vrijeme partije (a match closed by the clock) or by being
// played to the end.
export function lockKind(t: {open: boolean; attendance: string | null; matches: {time_expired: boolean}[]; ongoing: number}): PadLock | null {
  if (t.attendance === "NO_SHOW") return "no_show";
  if (t.attendance === "SKIPPED") return "skipped";
  if (t.open || t.ongoing > 0) return null;
  return t.matches.some((m) => m.time_expired) ? "time_expired" : "done";
}

// What the unlock will do, said to the admin before they confirm it (one line per consequence). minutes: the
// tournament's Vrijeme partije, which a match played on gets from the unlock.
export function unlockEffects(kind: PadLock, teams: {absent: string | null; both: [string, string]}, minutes: number): string[] {
  if (kind === "no_show") {
    const back = teams.absent ? `${teams.absent} se vraćaju u turnir` : "Isključena ekipa se vraća u turnir";
    return [
      `Upisani rezultat ${NO_SHOW_SCORE[0]} : ${NO_SHOW_SCORE[1]} se briše, stol je ponovo nov i igra može početi.`,
      `${back} i igraju ostala kola.`,
      "Automatska zabrana prijava zbog nedolaska u 1. kolu se ukida (ako je bila).",
    ];
  }
  if (kind === "skipped") {
    return [
      "Stol je ponovo nov i igra može početi.",
      `${teams.both[0]} i ${teams.both[1]} se vraćaju u turnir i igraju ostala kola.`,
      "Automatska zabrana prijava zbog nedolaska u 1. kolu se ukida (ako je bila).",
    ];
  }
  return [
    `${kind === "time_expired" ? "Zadnja partija" : "Zadnja odigrana partija"} se nastavlja s upisanim igrama i traje još ${minutes} min od sada (Vrijeme partije turnira).`,
    "Pobjeda te partije se skida s rezultata stola dok se partija ponovo ne završi.",
  ];
}

// The warning every unlock carries: Kola already made from this result stay as they are
export const UNLOCK_KOLO_WARNING = "Kola koja su složena s ovim rezultatom ostaju kakva su. Ako treba, složi ih ponovo.";
