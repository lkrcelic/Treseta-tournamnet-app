import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LeagueCreateRequest, LeagueSummary, LeagueTeamDetails, LeagueUpdateRequest} from "@/app/_interfaces/league";

export async function getLeaguesAPI(): Promise<LeagueSummary[]> {
  const response = await apiFetch("/api/leagues");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Lige se nisu učitale."));
  return response.json();
}

export async function createLeagueAPI(league: Partial<LeagueCreateRequest> & {league_name: string}): Promise<LeagueSummary> {
  const response = await apiFetch("/api/leagues", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(league),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Liga nije napravljena."));
  return response.json();
}

// Teams of a league with players and the active flag (admin only)
export async function getLeagueTeamsAPI(leagueId: number): Promise<LeagueTeamDetails[]> {
  const response = await apiFetch(`/api/leagues/${leagueId}/teams`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Ekipe se nisu učitale."));
  return response.json();
}

export async function addTeamToLeagueAPI(leagueId: number, teamId: number): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/teams`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({team_id: teamId}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Ekipa nije dodana."));
}

export async function setLeagueTeamActiveAPI(leagueId: number, teamId: number, active: boolean): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/teams/${teamId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({active}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Promjena ekipe nije spremljena."));
}

// conferenceId null: the team leaves its conference
export async function setLeagueTeamConferenceAPI(leagueId: number, teamId: number, conferenceId: number | null): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/teams/${teamId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({conference_id: conferenceId}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Konferencija ekipe nije spremljena"));
}

export async function updateLeagueAPI(leagueId: number, league: LeagueUpdateRequest): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(league),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Promjene lige nisu spremljene."));
}

export async function getLeagueNotesAPI(leagueId: number): Promise<string> {
  const response = await apiFetch(`/api/leagues/${leagueId}/notes`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Bilješke se nisu učitale."));
  return (await response.json()).notes;
}

// keepalive: notes typed just before leaving the page are still saved
export async function saveLeagueNotesAPI(leagueId: number, notes: string, keepalive = false): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/notes`, {
    method: "PUT",
    keepalive,
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({notes}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Bilješke nisu spremljene."));
}

// keepalive: a delete waiting for its undo window still goes out when the page is closed
export async function removeTeamFromLeagueAPI(leagueId: number, teamId: number, keepalive = false): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/teams/${teamId}`, {method: "DELETE", keepalive});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Ekipa nije uklonjena iz lige."));
}
