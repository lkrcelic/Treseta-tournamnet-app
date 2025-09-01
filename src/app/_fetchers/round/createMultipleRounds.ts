import {CreateRoundType} from "@/app/_interfaces/round";

export async function createMultipleRoundsAPI(selectedLeagueId: number, teamIds: number[]): Promise<number> {
  const response = await fetch("api/rounds/generate-multiple", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({league_id: selectedLeagueId, present_teams: teamIds} as CreateRoundType),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch team data: ${response.statusText}`);
  }
  const data = await response.json();
  return data.round_number;
}
