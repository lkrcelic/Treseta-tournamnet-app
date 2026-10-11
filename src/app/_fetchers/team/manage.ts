import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {TeamExtendedResponse, TeamsResponseValidation} from "@/app/_interfaces/team";

// Every team with its players and leagues (Manage Teams)
export async function getTeamsAPI(): Promise<TeamExtendedResponse[]> {
  const response = await fetch("/api/teams");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to fetch teams"));
  return TeamsResponseValidation.parse(await response.json());
}

export async function renameTeamAPI(teamId: number, team_name: string): Promise<void> {
  const response = await fetch(`/api/teams/${teamId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({team_name}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to rename the team"));
}

export async function addTeamPlayerAPI(teamId: number, player_id: number): Promise<void> {
  const response = await fetch(`/api/teams/${teamId}/players`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({player_id}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to add the teammate"));
}

export async function removeTeamPlayerAPI(teamId: number, playerId: number): Promise<void> {
  const response = await fetch(`/api/teams/${teamId}/players/${playerId}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to remove the teammate"));
}
