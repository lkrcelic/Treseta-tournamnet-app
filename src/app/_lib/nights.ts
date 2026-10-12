// League nights (Upravljanje ligom · Datumi, Nova liga, Raspored, Burza igrača). Framework free so they can be unit
// tested.
import {count, NOUN} from "@/app/_lib/ui/text";

// The most nights a league can have: a weekly league over two seasons, so a mistyped year can't fill thousands
export const MAX_NIGHTS = 120;

const DAY_MS = 86_400_000;
const WEEKDAYS_SHORT = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

function utcTime(iso: string): number | null {
  return isIsoDate(iso) ? Date.parse(`${iso}T00:00:00Z`) : null;
}

const isoOf = (time: number) => new Date(time).toISOString().slice(0, 10);

// Every play day from the start date to the end date, both included. playDay: 0 = Monday ... 6 = Sunday, as
// League.play_day. Empty when any of the three is missing or the end is before the start.
export function generateNights(start: string | null | undefined, end: string | null | undefined, playDay: number | null | undefined): string[] {
  if (!start || !end || playDay == null) return [];
  const from = utcTime(start);
  const to = utcTime(end);
  if (from == null || to == null || to < from) return [];
  // getUTCDay counts from Sunday
  const weekday = (playDay + 1) % 7;
  let time = from + ((weekday - new Date(from).getUTCDay() + 7) % 7) * DAY_MS;
  const nights: string[] = [];
  while (time <= to && nights.length < MAX_NIGHTS) {
    nights.push(isoOf(time));
    time += 7 * DAY_MS;
  }
  return nights;
}

// The nights without repeats, in date order
export function sortNights(nights: string[]): string[] {
  return Array.from(new Set(nights)).sort();
}

// "uto 13. 10." (Raspored, Burza)
export function nightLabel(iso: string): string {
  const time = utcTime(iso);
  if (time == null) return iso;
  const d = new Date(time);
  return `${WEEKDAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`;
}

// "uto 13. 10. 2026." (Upravljanje ligom · Datumi)
export function nightLabelLong(iso: string): string {
  const time = utcTime(iso);
  return time == null ? iso : `${nightLabel(iso)} ${new Date(time).getUTCFullYear()}.`;
}

// The next night (tonight counts as next), or -1 when the season is over; nights are in date order
export function nextNightIndex(nights: string[], today: string): number {
  return nights.findIndex((n) => n >= today);
}

export type NightStatus = "played" | "notPlayed" | "next" | "upcoming";

// A past night was played when it has rounds; the next night is the first from today on
export function nightStatus(night: string, isNext: boolean, today: string, hasRounds: boolean): NightStatus {
  if (night < today) return hasRounds ? "played" : "notPlayed";
  return isNext ? "next" : "upcoming";
}

// The status pill of a night in Upravljanje ligom · Datumi
export const NIGHT_STATUS_LABEL: Record<NightStatus, string> = {
  played: "Odigrano",
  notPlayed: "Nije odigrano",
  next: "Sljedeća",
  upcoming: "Nadolazi",
};

// The pills of Raspored: past nights, the next one (tonight on a league night) and the season's last one
export type RasporedPill = "played" | "notPlayed" | "tonight" | "next" | "last";

export const RASPORED_PILL: Record<RasporedPill, string> = {
  played: "Odigrano",
  notPlayed: "Nije odigrano",
  tonight: "Večeras",
  next: "Sljedeća",
  last: "Zadnja",
};

// A night's pill in Raspored, as nightStatus; isLast: the season's last night. null for a future night that is
// neither the next nor the last one.
export function rasporedPill(night: string, isNext: boolean, isLast: boolean, today: string, hasRounds: boolean): RasporedPill | null {
  const status = nightStatus(night, isNext, today, hasRounds);
  if (status === "next") return night === today ? "tonight" : "next";
  if (status === "upcoming") return isLast ? "last" : null;
  return status;
}

// "6 odigrano · još 10" (Upravljanje ligom · Datumi): nights with rounds, and nights from today on; after the season
// only "6 odigrano"
export function nightsSummaryLabel(played: number, toGo: number): string {
  const playedLabel = count(played, NOUN.odigrana);
  return toGo > 0 ? `${playedLabel} · još ${toGo}` : playedLabel;
}

// "još 10 večeri do kraja sezone"
export function nightsLeftLabel(left: number): string {
  if (left === 0) return "Sezona je završila";
  return `još ${count(left, NOUN.večer)} do kraja sezone`;
}

// "16 večeri · 6 odigrano"
export function nightsCountLabel(total: number, played: number): string {
  return `${count(total, NOUN.večer)} · ${count(played, NOUN.odigrana)}`;
}
