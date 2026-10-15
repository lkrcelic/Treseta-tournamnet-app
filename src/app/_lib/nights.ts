// League nights (Upravljanje ligom · Datumi, Nova liga, Raspored, Burza igrača). Framework free so they can be unit
// tested.
import {count, NOUN} from "@/app/_lib/ui/text";

// The most nights a league can have: a weekly league over two seasons, so a mistyped year can't fill thousands
export const MAX_NIGHTS = 120;

const DAY_MS = 86_400_000;
const WEEKDAYS_SHORT = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];

const isoOf = (time: number) => new Date(time).toISOString().slice(0, 10);

// A real day as YYYY-MM-DD ("2026-02-31" isn't one, though Date.parse rolls it over to March)
export const isIsoDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const time = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(time) && isoOf(time) === v;
};

function utcTime(iso: string): number | null {
  return isIsoDate(iso) ? Date.parse(`${iso}T00:00:00Z`) : null;
}

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

// A night's start time: a wall-clock "HH:MM" from 00:00 to 23:59, as League.start_time and LeagueNight.start_time
export const isStartTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

// When a night starts: its own time, else the league's, else none
export function effectiveTime(own: string | null | undefined, leagueTime: string | null | undefined): string | null {
  return own || leagueTime || null;
}

// Where a night is played: a place's name, its address and a Google Maps link (both optional)
export type NightLocation = {name: string; address: string | null; url: string | null};

// The location columns of League and LeagueNight
export type LocationColumns = {location_name: string | null; location_address: string | null; location_url: string | null};

// A row's location, or null without a name (a night without a name of its own uses the league's)
export function locationOf(row: LocationColumns): NightLocation | null {
  return row.location_name ? {name: row.location_name, address: row.location_address || null, url: row.location_url || null} : null;
}

// Where a night is played: its own location, else the league's, else none
export function effectiveLocation(night: LocationColumns, league: LocationColumns): NightLocation | null {
  return locationOf(night) ?? locationOf(league);
}

// Only http(s) links are shown as links (a "javascript:" link would run on a click)
export const isSafeUrl = (v: string | null | undefined) => !!v && /^https?:\/\//i.test(v.trim());

// "19:30 · Caffe bar Kartaš", "19:30", "Caffe bar Kartaš", or null when there is neither (Datumi, Raspored, Početna)
export function gatheringLabel(time: string | null | undefined, loc: NightLocation | null | undefined): string | null {
  return [time, loc?.name].filter(Boolean).join(" · ") || null;
}

// The mark of a night with its own time or place (Datumi, Raspored): what it says to a screen reader; null for a
// night that follows the league
export function exceptionLabel(ownTime: boolean, ownPlace: boolean): string | null {
  if (ownTime && ownPlace) return "Drugo vrijeme i mjesto";
  if (ownTime) return "Drugo vrijeme";
  return ownPlace ? "Drugo mjesto" : null;
}

// The night's own start time as it is saved: one equal to the league's isn't kept (the night then follows a later
// change of the league's), and an empty one is the league's
export const ownTimeOf = (time: string | null | undefined, leagueTime: string | null | undefined) => (time && time !== leagueTime ? time : null);

// Two locations are the same place (null: none)
export function sameLocation(a: NightLocation | null | undefined, b: NightLocation | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.name === b.name && (a.address ?? null) === (b.address ?? null) && (a.url ?? null) === (b.url ?? null);
}

// "sri 14. 10. · 19:00" (Raspored, Početna); a night without a time is only its date
export function nightTimeLabel(iso: string, time: string | null | undefined): string {
  return time ? `${nightLabel(iso)} · ${time}` : nightLabel(iso);
}

// A start time in a list column (Upravljanje ligom · Datumi): "19:00", or "—" without one
export const timeLabel = (time: string | null | undefined) => time || "—";

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
