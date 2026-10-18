import {LEAGUE_TIME_ZONE} from "@/app/_lib/dates";

// Publishing rounds (Upravljanje ligom · Skica): Novo kolo creates a night's rounds as drafts, an admin approves them
// one by one or all at once and publishes the approved ones. Until then only admins see a round: players, the
// standings and every public page see published rounds only. A round is a round number on a night (all its tables
// share the status); a round not published yet has a number only to keep its tables together, and is shown as
// Skica A, B, C. Framework free so it can be unit tested.

export type RoundStatus = "DRAFT" | "APPROVED" | "PUBLISHED";

// The where clause (Prisma) of the rounds players see
export const PUBLISHED_ROUND = {status: "PUBLISHED"} as const;
// The rounds an admin can still approve, take back or discard
export const UNPUBLISHED_STATUSES: RoundStatus[] = ["DRAFT", "APPROVED"];

export const ROUND_ALREADY_PUBLISHED = "Kolo je već objavljeno.";
export const NOTHING_APPROVED = "Nijedno kolo te večeri nije odobreno.";
export const NO_DRAFT = "Ta večer nema neobjavljenih kola.";
export const ROUND_NOT_PUBLISHED = "Ovo kolo još nije objavljeno.";
// Novo kolo while tonight's rounds wait in Skica: they are published or discarded first
export const DRAFT_WAITING = "DRAFT_WAITING";
export const DRAFT_WAITING_ERROR = "Večeras već čeka skica. Objavi kola koja želiš, a ostala odbaci, pa kreiraj nova.";

// A round waiting in Skica has no number yet: it is Skica A, B, C… by its place in the batch Novo kolo created
// (Round.draft_order, 1 = A). It gets its Kolo number when it is published (publishNumbers).
export function draftLetter(order: number): string {
  return String.fromCharCode(64 + Math.min(26, Math.max(1, order)));
}

// What a round is called on the admin's screens: "Kolo 7" once published, "Skica B" until then
export function roundName(r: {roundNumber: number; letter: string | null}): string {
  return r.letter ? `Skica ${r.letter}` : `Kolo ${r.roundNumber}`;
}

// The letters of a night's rounds not published yet, by round number: from their draft order, else (a round from
// before draft orders) their place among them
export function draftLetters(rounds: {roundNumber: number; status: RoundStatus; draftOrder: number | null}[]): Map<number, string> {
  const waiting = rounds.filter((r) => r.status !== "PUBLISHED").sort((a, b) => a.roundNumber - b.roundNumber);
  return new Map(waiting.map((r, i) => [r.roundNumber, draftLetter(r.draftOrder ?? i + 1)]));
}

// "Objavi odobrena kola": the numbers a night's rounds not published yet get. The approved ones are numbered after
// the league's last published round, in their letter order, so publishing only Skica C makes it the next round with
// no gap; the drafts left get the numbers after them (unseen, they only keep the rounds apart). Returns the new
// number of each round by its number now.
export function publishNumbers(
  rounds: {roundNumber: number; status: RoundStatus; draftOrder: number | null}[],
  lastPublished: number
): Map<number, number> {
  const order = (a: (typeof rounds)[number], b: (typeof rounds)[number]) =>
    (a.draftOrder ?? Infinity) - (b.draftOrder ?? Infinity) || a.roundNumber - b.roundNumber;
  const approved = rounds.filter((r) => r.status === "APPROVED").sort(order);
  const drafts = rounds.filter((r) => r.status === "DRAFT").sort(order);
  return new Map([...approved, ...drafts].map((r, i) => [r.roundNumber, lastPublished + 1 + i]));
}

// The status "Odobri" (approve) or taking it back (approve = false) gives a round: a draft becomes approved and an
// approved round a draft again; asking twice changes nothing. A published round can't go back.
export function approvalStatus(current: RoundStatus, approve: boolean): {status: RoundStatus} | {error: string} {
  if (current === "PUBLISHED") return {error: ROUND_ALREADY_PUBLISHED};
  return {status: approve ? "APPROVED" : "DRAFT"};
}

// The where clause (Prisma) of the rounds a viewer may read: an admin every round, anyone else the published ones
export function visibleRounds(admin: boolean): {status?: "PUBLISHED"} {
  return admin ? {} : PUBLISHED_ROUND;
}

// The rounds "Odobri sva" approves: the drafts; approved and published rounds stay as they are
export function roundsToApprove<T extends {status: RoundStatus}>(rounds: T[]): T[] {
  return rounds.filter((r) => r.status === "DRAFT");
}

// The rounds "Objavi odobrena kola" publishes: the approved ones; drafts stay drafts
export function roundsToPublish<T extends {status: RoundStatus}>(rounds: T[]): T[] {
  return rounds.filter((r) => r.status === "APPROVED");
}

// The rounds "Odbaci skicu" deletes: every one not published yet; published rounds stay
export function roundsToDiscard<T extends {status: RoundStatus}>(rounds: T[]): T[] {
  return rounds.filter((r) => r.status !== "PUBLISHED");
}

// One status for a round's tables. They always share it; should they ever differ, the round is published only when
// every table is, and approved when every table not published yet is.
export function roundStatusOf(tables: {status: RoundStatus}[]): RoundStatus {
  const waiting = tables.filter((t) => t.status !== "PUBLISHED");
  if (tables.length > 0 && waiting.length === 0) return "PUBLISHED";
  return waiting.length > 0 && waiting.every((t) => t.status === "APPROVED") ? "APPROVED" : "DRAFT";
}

export type DraftCounts = {
  // the night's rounds
  total: number;
  published: number;
  // approved and not published yet
  approved: number;
  // not published yet (drafts and approved)
  unpublished: number;
};

export function draftCounts(rounds: {status: RoundStatus}[]): DraftCounts {
  const published = rounds.filter((r) => r.status === "PUBLISHED").length;
  return {
    total: rounds.length,
    published,
    approved: rounds.filter((r) => r.status === "APPROVED").length,
    unpublished: rounds.length - published,
  };
}

// The publish button: "Objavi odobrena kola · 1/2" (approved / not published yet)
export function publishLabel(c: DraftCounts): string {
  return `Objavi odobrena kola · ${c.approved}/${c.unpublished}`;
}

// The line under the publish button
export function publishNote(c: DraftCounts): string {
  if (c.published > 0) return `Objavljeno ${c.published} od ${c.total} kola. Ostala igrači još ne vide.`;
  if (c.approved > 0) return "Neodobrena kola ostaju u skici.";
  return "Odobri barem jedno kolo da ga možeš objaviti.";
}

// When the night's rounds went out, in league time: "24.02. u 18:42"
export function publishedAtLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat("hr-HR", {
    timeZone: LEAGUE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}. u ${part("hour")}:${part("minute")}`;
}

// The time the night's rounds went out, in league time: "18:42" (Skica kola on the phone: "Igrači vide svoje stolove
// od 18:42.")
export function publishedTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("hr-HR", {timeZone: LEAGUE_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(new Date(iso));
}
