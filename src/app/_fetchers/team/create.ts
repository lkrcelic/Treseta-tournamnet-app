export async function createTeamAPI(team_name: string, founder_id1: number, founder_id2: number): Promise<number> {
  const response = await fetch("/api/teams", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({team_name: team_name, founder_id1: founder_id1, founder_id2: founder_id2}),
  });

  if (!response.ok) {
    throw new Error(`Failed to create team: ${response.statusText}`);
  }

  const data = await response.json();
  return data.team_id;
}
