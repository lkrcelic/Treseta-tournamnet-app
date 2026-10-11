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
