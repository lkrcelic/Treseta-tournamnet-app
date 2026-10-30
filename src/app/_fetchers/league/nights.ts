import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LeagueNightAdd, LeagueNightRow, LeagueNightUpdate} from "@/app/_interfaces/league";

// A league's nights with whether each has rounds and when it starts (public)
export async function getLeagueNightsAPI(leagueId: number): Promise<LeagueNightRow[]> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights`, {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Večeri lige se nisu učitale."));
  return response.json();
}

// A new night with its own start time and place (null: the league's)
export async function addLeagueNightAPI(leagueId: number, night: LeagueNightAdd): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(night),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Večer nije dodana."));
}

// A night's new date, own start time and place (Uredi večer); any left out stays as it is, null goes back to the
// league's. Returns the night as saved (under its new date when it moved).
export async function updateLeagueNightAPI(leagueId: number, date: string, change: LeagueNightUpdate): Promise<LeagueNightRow> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights/${date}`, {
    method: "PATCH",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(change),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Večer nije spremljena."));
  return response.json();
}

// withRounds: a played night goes with its rounds and their results
export async function removeLeagueNightAPI(leagueId: number, date: string, withRounds = false): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights/${date}${withRounds ? "?with_rounds=1" : ""}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Večer nije uklonjena."));
}
