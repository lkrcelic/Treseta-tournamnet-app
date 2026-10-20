// Who plays a round: two players of each team picked on Start Game (see service/round/lineup.ts), or for an older
// round the team's whole roster, saved before it changed (lineupFreezeRows)

import {isByeTeam} from "./bye";

export const PLAYERS_PER_TEAM = 2;

/**
 * The players a team starts with: the ones who played its last round in the league, or its founders when it has none
 * (the league's first round), topped up from the roster. Only players still on the roster count. A "last round"
 * with more players than a lineup has is a roster saved by lineupFreezeRows, not a pick, so the founders go first.
 */
export function defaultLineup(roster: number[], lastPlayed: number[] | null, founders: (number | null)[]): number[] {
  const needed = Math.min(PLAYERS_PER_TEAM, roster.length);
  const picked: number[] = [];
  const take = (ids: (number | null)[]) => {
    for (const id of ids) {
      if (picked.length < needed && id != null && roster.includes(id) && !picked.includes(id)) picked.push(id);
    }
  };
  const picks = lastPlayed && lastPlayed.length > 0 && lastPlayed.length <= PLAYERS_PER_TEAM;
  take(picks ? lastPlayed : founders);
  take(roster);
  return picked;
}

/**
 * The players a team's seats can be filled from: its active roster, and for a finished round also whoever was saved
 * as having played it (deactivated or off the team since), so an admin can confirm or correct who played it then.
 */
export function lineupPool(activeRoster: number[], saved: number[], open: boolean): number[] {
  return open ? activeRoster : Array.from(new Set([...activeRoster, ...saved]));
}

// The same players, in any order
export function sameLineup(a: number[], b: number[]): boolean {
  const set = new Set(a);
  return set.size === a.length && a.length === new Set(b).size && b.every((id) => set.has(id));
}

// The players a round is rated with: its lineup for that team, or the whole roster for a round without one
export function ratedPlayerIds(lineup: {player_id: number; team_id: number}[], teamId: number, roster: number[]): number[] {
  const played = lineup.filter((p) => p.team_id === teamId).map((p) => p.player_id);
  return played.length > 0 ? played : roster;
}

type LineupRow = {round_id: number; player_id: number; team_id: number};

// A round as the freeze reads it: its teams and the lineup rows it already has
export type FreezeRound = {id: number; open: boolean; team1_id: number; team2_id: number; lineup: {player_id: number; team_id: number}[]};

/**
 * The lineup rows that keep these teams' ratings where they are before their rosters change. A finished round without
 * a lineup for a team is rated with that team's roster of today (ratedPlayerIds), so adding or removing a player
 * would change it at the next rating replay; saving today's roster as the lineup first keeps it as it was.
 * `rosters` holds the teams whose roster changes (team id → player ids); the other team of a round is left alone,
 * and so are open rounds, bye rounds and a team that already has a lineup in the round. A player on both teams'
 * rosters (an old round, rated for both sides) is saved for both: the lineup key has the team in it.
 */
export function lineupFreezeRows(rounds: FreezeRound[], rosters: Map<number, number[]>): LineupRow[] {
  const rows: LineupRow[] = [];
  for (const r of rounds) {
    if (r.open || isByeTeam(r.team1_id) || isByeTeam(r.team2_id)) continue;
    for (const teamId of [r.team1_id, r.team2_id]) {
      const roster = rosters.get(teamId);
      if (!roster || r.lineup.some((p) => p.team_id === teamId)) continue;
      for (const player_id of Array.from(new Set(roster))) rows.push({round_id: r.id, player_id, team_id: teamId});
    }
  }
  return rows;
}
