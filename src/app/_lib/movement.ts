// Ukupni poredak's +/−: how many places a team gained or lost since the league's previous night. The server works it
// out with the standings (service/league/getStandings.ts). Framework free so it can be unit tested.
import {leagueEnded} from "@/app/_lib/league";
import {LeagueRow, LeagueTable, rankLeague} from "@/app/_lib/leagueOrder";

// A team's season numbers, as a TeamScore row holds them
export type TeamTotals = LeagueRow;

// Whether the +/− is shown, and from which night: the league's nights with (published) rounds, in date order, give the
// last one played and the one before it. Not on the league's first night (nothing to compare with) nor once the league
// is over (leagueEnded: its end date, or its last night without one, has passed). Dates are YYYY-MM-DD.
export function movementShown(nights: string[], end: string | null, lastNight: string | null, today: string): {show: boolean; since: string | null} {
  const since = nights.length >= 2 ? nights[nights.length - 2] : null;
  if (since == null || leagueEnded(end, lastNight, today)) return {show: false, since: null};
  return {show: true, since};
}

// Each team's change: its place after the previous night minus its place now, so a positive number is a team that
// went up. `current` is the table now, in its order; `before` holds the numbers after the previous night, and
// tablesBefore the tables played by then, for the head-to-head of the teams level then (the league's order,
// leagueOrder.ts). Both tables rank the same teams (the league's teams now, the ones without a round counted as 0), so
// a team that joined later doesn't move the others. A team that hadn't played by the previous night wasn't in that
// table: no change (null).
export function rankMovement(
  current: TeamTotals[],
  before: ReadonlyMap<number, Omit<TeamTotals, "team_id" | "name">>,
  tablesBefore: LeagueTable[] = []
): Map<number, number | null> {
  const then = rankLeague(
    current.map((t) => ({team_id: t.team_id, name: t.name, score: 0, point_difference: 0, rounds_played: 0, ...before.get(t.team_id)})),
    (t) => t,
    tablesBefore
  );
  const placeThen = new Map(then.map((t, i) => [t.team_id, i + 1]));
  return new Map(
    current.map((t, i) => {
      const played = (before.get(t.team_id)?.rounds_played ?? 0) > 0;
      return [t.team_id, played ? placeThen.get(t.team_id)! - (i + 1) : null];
    })
  );
}
