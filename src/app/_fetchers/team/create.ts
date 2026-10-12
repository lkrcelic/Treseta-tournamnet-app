import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

// A new team with its players (the first two become its founders) in a league (default: the current league);
// returns the new team's id
export async function createTeamAPI(team_name: string, players: number[], league_id?: number): Promise<number> {
  const response = await apiFetch("/api/teams", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({team_name, players, league_id}),
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Ekipa nije napravljena."));
  }

  const data = await response.json();
  return data.team_id;
}
