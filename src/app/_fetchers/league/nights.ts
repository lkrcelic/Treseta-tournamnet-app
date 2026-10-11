import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {LeagueNightRow} from "@/app/_interfaces/league";

// A league's nights with whether each has rounds (public)
export async function getLeagueNightsAPI(leagueId: number): Promise<LeagueNightRow[]> {
  const response = await fetch(`/api/leagues/${leagueId}/nights`, {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to fetch the league nights"));
  return response.json();
}

export async function addLeagueNightAPI(leagueId: number, date: string): Promise<void> {
  const response = await fetch(`/api/leagues/${leagueId}/nights`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({date}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to add the night"));
}

export async function removeLeagueNightAPI(leagueId: number, date: string): Promise<void> {
  const response = await fetch(`/api/leagues/${leagueId}/nights/${date}`, {method: "DELETE"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to remove the night"));
}
