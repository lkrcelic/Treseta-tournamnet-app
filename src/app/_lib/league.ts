// The league being played now is the one with the most recent round night, so a new season's league takes over
// with its first round. Until any league has played, the newest league is the active one.
export function pickActiveLeague<T extends {league_id: number; last_played: string | null}>(leagues: T[]): number | null {
  let best: T | null = null;
  for (const l of leagues) {
    const a = l.last_played ?? "";
    const b = best?.last_played ?? "";
    if (!best || a > b || (a === b && l.league_id > best.league_id)) best = l;
  }
  return best?.league_id ?? null;
}

// Whether a league's season is over ("Završeno"; otherwise "U tijeku"): its end date has passed or, for a league
// without an end date (the older ones), its last night has. A league with neither is still running. Dates are
// YYYY-MM-DD; today is the league date (leagueDateString), so the end date itself and tonight still count as running.
export function leagueEnded(end: string | null, lastNight: string | null, today: string): boolean {
  if (end != null) return end < today;
  return lastNight != null && lastNight < today;
}

export type LeaguePage = "daily-standings" | "standings" | "manage";

// A link to a page of the active league: straight to it once its id is known (useActiveLeagueId), otherwise through
// /league/current, which finds it on the server (a full page load, so only a fallback)
export const currentLeagueHref = (page: LeaguePage, activeId?: number | null) =>
  activeId != null ? `/league/${activeId}/${page}` : `/league/current/${page}`;
