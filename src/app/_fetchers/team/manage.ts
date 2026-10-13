import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {TeamExtendedResponse, TeamsResponseValidation} from "@/app/_interfaces/team";

// Every team with its players and leagues (the admin's Ekipe directory; usernames only for admins)
export async function getTeamsAPI(): Promise<TeamExtendedResponse[]> {
  const response = await apiFetch("/api/teams");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Ekipe se nisu učitale."));
  return TeamsResponseValidation.parse(await response.json());
}

export async function renameTeamAPI(teamId: number, team_name: string): Promise<void> {
  const response = await apiFetch(`/api/teams/${teamId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({team_name}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Ime ekipe nije spremljeno."));
}

export async function addTeamPlayerAPI(teamId: number, player_id: number): Promise<void> {
  const response = await apiFetch(`/api/teams/${teamId}/players`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({player_id}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Igrač nije dodan u ekipu."));
}

export async function removeTeamPlayerAPI(teamId: number, playerId: number): Promise<void> {
  const response = await apiFetch(`/api/teams/${teamId}/players/${playerId}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Igrač nije uklonjen iz ekipe."));
}
