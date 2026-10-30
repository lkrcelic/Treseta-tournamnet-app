// The league plays in Croatia, so "today" and a round's date follow Zagreb time, not the server's UTC clock
// (otherwise a round created after midnight but before 02:00 would get yesterday's date).
export const LEAGUE_TIME_ZONE = "Europe/Zagreb";

// YYYY-MM-DD of the given moment in league time
export function leagueDateString(moment: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

// A league night runs past midnight: until 06:00 it is still the evening before
export const NIGHT_ENDS_AT_HOUR = 6;

// The league night (YYYY-MM-DD, league time) a moment belongs to: before 06:00 it is still the night before. The night
// tonight's rounds are on: new rounds are created on it, and Novo kolo, Skica, Večer lige, Dnevni poredak's "večeras"
// and the live dot follow it, so a night that runs past midnight stays one night. A plain calendar day (a birth date,
// Burza, Raspored, Datumi) is leagueDateString.
export function leagueNightString(moment: Date = new Date()): string {
  return leagueDateString(new Date(moment.getTime() - NIGHT_ENDS_AT_HOUR * 60 * 60 * 1000));
}

// The league night as a Date at UTC midnight, as a round's round_date is stored
export function leagueNight(moment: Date = new Date()): Date {
  return new Date(`${leagueNightString(moment)}T00:00:00.000Z`);
}

// The league date as a Date at UTC midnight, which is what Prisma stores unchanged in a @db.Date column
export function leagueDate(moment: Date = new Date()): Date {
  return new Date(`${leagueDateString(moment)}T00:00:00.000Z`);
}

// A match keeps its date and start time in separate columns (a DATE and a TIME), which Prisma reads as two Dates:
// the day at UTC midnight and the time on 1970-01-01. This joins them into one moment.
export function combineDateAndTime(date: Date | null | undefined, time: Date | null | undefined): Date | null {
  if (!time) return null;
  if (!date) return time;
  const day = date.toISOString().slice(0, 10);
  const clock = time.toISOString().slice(11, 23);
  return new Date(`${day}T${clock}Z`);
}

// The offset of league time from UTC at a moment, in minutes (60 in winter, 120 in summer)
function leagueOffsetMinutes(moment: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAGUE_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(moment);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  return Math.round((asUtc - Math.floor(moment.getTime() / 60_000) * 60_000) / 60_000);
}

// The moment a league-time wall clock shows: day YYYY-MM-DD at HH:MM in Zagreb (a tournament's Okupljanje and Početak)
export function leagueMoment(day: string, time: string): Date {
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const first = wall - leagueOffsetMinutes(new Date(wall)) * 60_000;
  // around a clock change the offset at the guess can differ from the offset at the result
  return new Date(wall - leagueOffsetMinutes(new Date(first)) * 60_000);
}

// "9:43": a moment's league-time clock, as the screens write a time of day
export function leagueClock(moment: Date): string {
  return new Intl.DateTimeFormat("hr-HR", {timeZone: LEAGUE_TIME_ZONE, hour: "numeric", minute: "2-digit", hourCycle: "h23"}).format(moment);
}
