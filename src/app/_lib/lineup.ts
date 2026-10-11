// Who plays a round: two players of each team (see service/round/lineup.ts)

export const PLAYERS_PER_TEAM = 2;

/**
 * The players a team starts with: the ones who played its last round in the league, or its founders when it has none
 * (the league's first round), topped up from the roster. Only players still on the roster count.
 */
export function defaultLineup(roster: number[], lastPlayed: number[] | null, founders: (number | null)[]): number[] {
  const needed = Math.min(PLAYERS_PER_TEAM, roster.length);
  const picked: number[] = [];
  const take = (ids: (number | null)[]) => {
    for (const id of ids) {
      if (picked.length < needed && id != null && roster.includes(id) && !picked.includes(id)) picked.push(id);
    }
  };
  take(lastPlayed?.length ? lastPlayed : founders);
  take(roster);
  return picked;
}

// The players a round is rated with: its lineup for that team, or the whole roster for a round without one
export function ratedPlayerIds(lineup: {player_id: number; team_id: number}[], teamId: number, roster: number[]): number[] {
  const played = lineup.filter((p) => p.team_id === teamId).map((p) => p.player_id);
  return played.length > 0 ? played : roster;
}
