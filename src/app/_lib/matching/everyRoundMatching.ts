export interface Team {
    readonly id: number;
    readonly name: string;
    readonly point_difference: number;
    readonly score: number;
    modified_score?: number | null | undefined;
    played_against: number[]; // ids of teams already played against!
  }
  
  export interface TeamPair {
    teamOne: Team;
    teamTwo: Team;
  }
  
  export function matchTeams(teams: Team[]): TeamPair[] {
    const team_pairs: TeamPair[] = [];
    const chosenPoolSize = Math.max(teams.length / 8, 2);
  
    teams.sort((a, b) => a.score === b.score ? b.point_difference - a.point_difference : b.score - a.score);
  
    if (teams.length % 2) {
      team_pairs.push({
        teamOne: teams.pop(),
        teamTwo: {id: parseInt(process.env.BYE_ID ?? "0"), name: "bye", score: 0, played_against: []},
      });
    }
  
    while (true) {
      if (teams.length == 0) break;
  
      const currentTeam = teams.shift();
  
      const forbiddenMatchups = currentTeam.played_against.slice(-3)
      const times_played_against: Record<number, number> = {};
      currentTeam.played_against.forEach((num) => {
        times_played_against[num] = (times_played_against[num] || 0) + 1;
      });
  
      const possibleTeams = teams.slice(0, chosenPoolSize)
        .sort((a, b) => {
          const aForbidden = forbiddenMatchups.includes(a.id) ? 1 : 0;
          const bForbidden = forbiddenMatchups.includes(b.id) ? 1 : 0;
  
          // First, move forbidden teams to the bottom
          if (aForbidden !== bForbidden) {
            return aForbidden - bForbidden;
          }
  
          // If both are allowed or both are forbidden, sort by least times played against
          const aTimes = times_played_against[a.id] || 0;
          const bTimes = times_played_against[b.id] || 0;
  
          return aTimes - bTimes;
        });
  
      const opponentTeam = possibleTeams[0];
      const removeIndex = teams.findIndex(t => t.id === opponentTeam.id);
      teams.splice(removeIndex, 1);
  
      team_pairs.push({teamOne: currentTeam, teamTwo: opponentTeam});
    }
  
    if (team_pairs.length > 0 && team_pairs[0].teamTwo.name.toLowerCase() === 'bye') {
      const firstPair = team_pairs.shift();
      if (firstPair) {
        team_pairs.push(firstPair);
      }
    }
  
    return team_pairs;
  }
  