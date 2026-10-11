import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LeagueConferences, LeagueConferencesRequest, LeagueTeamConferencesRequest} from "@/app/_interfaces/league";

// A league's conferences and which team is in which (public)
export async function getLeagueConferencesAPI(leagueId: number): Promise<LeagueConferences> {
  const response = await fetch(`/api/leagues/${leagueId}/conferences`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Konferencije nije moguće učitati"));
  return response.json();
}

// Saves the league's whole list of conferences (admin); answers with the league's conferences as saved
export async function saveLeagueConferencesAPI(leagueId: number, conferences: LeagueConferencesRequest["conferences"]): Promise<LeagueConferences> {
  const response = await fetch(`/api/leagues/${leagueId}/conferences`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({conferences}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Konferencije nisu spremljene"));
  return response.json();
}

// Several teams' conferences at once (admin)
export async function setTeamConferencesAPI(leagueId: number, teams: LeagueTeamConferencesRequest["teams"]): Promise<LeagueConferences> {
  const response = await fetch(`/api/leagues/${leagueId}/conferences/teams`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({teams}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Konferencije ekipa nisu spremljene"));
  return response.json();
}
