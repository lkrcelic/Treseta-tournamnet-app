import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LeagueNightRow, LeagueNightUpdate} from "@/app/_interfaces/league";

// A league's nights with whether each has rounds and when it starts (public)
export async function getLeagueNightsAPI(leagueId: number): Promise<LeagueNightRow[]> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights`, {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Večeri lige se nisu učitale."));
  return response.json();
}

// startTime: the night's own start time (null: the league's)
export async function addLeagueNightAPI(leagueId: number, date: string, startTime: string | null = null): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({date, start_time: startTime}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Večer nije dodana."));
}

// A night's own start time and place (Okupljanje večeri); either left out stays as it is, null goes back to the
// league's. Returns the night as saved.
export async function updateLeagueNightAPI(leagueId: number, date: string, change: LeagueNightUpdate): Promise<LeagueNightRow> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights/${date}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(change),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Okupljanje večeri nije spremljeno."));
  return response.json();
}

export async function removeLeagueNightAPI(leagueId: number, date: string): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights/${date}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Večer nije uklonjena."));
}
