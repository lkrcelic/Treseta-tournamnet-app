// Potvrda dolaska in the league (DECISIONS #73): on a night of the league that has a start time, a team says it has
// come (Tu smo) from Okupljanje (without one, half an hour before the start; #80) until the night is over at 06:00. Novo kolo pairs the teams that
// are here, and the admin's switches there mark a team here or not (a team without a phone). Before the start a team
// takes its confirmation back (Ipak otkazujemo), after it it leaves (Odlazimo) and is out of the next Novo kolo; Tu smo
// again brings it back. Framework free so it can be unit tested.
import {leagueMoment, NIGHT_ENDS_AT_HOUR} from "@/app/_lib/dates";

// without an Okupljanje, Tu smo opens this long before the night's start
export const LEAGUE_ARRIVAL_OPENS_MS = 30 * 60_000;

export type LeagueArrivalWindow = {opens: Date; start: Date; closes: Date};

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// When Tu smo can be pressed on a night (YYYY-MM-DD) that starts at startTime ("HH:MM") and gathers from gatheringTime
// (an Okupljanje that isn't before the start doesn't count); null for a night without a start time, which has no
// confirmation (as a tournament without Početak)
export function leagueArrivalWindow(night: string, startTime: string | null | undefined, gatheringTime?: string | null): LeagueArrivalWindow | null {
  if (!startTime) return null;
  const start = leagueMoment(night, startTime);
  const gathering = gatheringTime ? leagueMoment(night, gatheringTime) : null;
  const opens = gathering && gathering.getTime() < start.getTime() ? gathering : new Date(start.getTime() - LEAGUE_ARRIVAL_OPENS_MS);
  const ends = `${String(NIGHT_ENDS_AT_HOUR).padStart(2, "0")}:00`;
  return {opens, start, closes: leagueMoment(nextDay(night), ends)};
}

// before: Tu smo isn't open yet; open: until the start (Tu smo, Ipak otkazujemo); started: the night is on (Tu smo ·
// Želimo uskočiti, Odlazimo); over: the night has ended
export type LeagueArrivalPhase = "before" | "open" | "started" | "over";

type Moment = Date | string;
const ms = (m: Moment) => new Date(m).getTime();

export function leagueArrivalPhase(w: {opens: Moment; start: Moment; closes: Moment}, now: Date): LeagueArrivalPhase {
  const t = now.getTime();
  if (t < ms(w.opens)) return "before";
  if (t < ms(w.start)) return "open";
  if (t < ms(w.closes)) return "started";
  return "over";
}

// A team is here: it came (a row) and hasn't left since
export const isHere = (a: {left_at: Moment | null} | null | undefined): boolean => a != null && a.left_at == null;

// What a team's own button does: confirm is Tu smo (arrive, or nothing for a team already here); leave is Ipak
// otkazujemo before the start (withdraw: as if it never confirmed) and Odlazimo after it (leave: it is out of the next
// Novo kolo). not_open and over: the button doesn't work now.
export type LeagueArrivalAction = "confirm" | "leave";
export type LeagueArrivalEffect = "arrive" | "withdraw" | "leave" | "none" | "not_open" | "over";

export function arrivalEffect(phase: LeagueArrivalPhase, action: LeagueArrivalAction, here: boolean): LeagueArrivalEffect {
  if (phase === "over") return "over";
  if (action === "confirm") {
    if (phase === "before") return "not_open";
    return here ? "none" : "arrive";
  }
  if (!here) return "none";
  return phase === "started" ? "leave" : "withdraw";
}
