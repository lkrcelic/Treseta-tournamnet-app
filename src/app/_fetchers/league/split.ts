import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {NightSplit, SplitMove, SplitResult} from "@/app/_interfaces/split";

// A night's Podjela: its places, the league's teams with their place, the conferences (admin)
export async function getNightSplitAPI(leagueId: number, date: string): Promise<NightSplit> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights/${date}/split`, {cache: "no-store"});
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Podjela ekipa se nije učitala."));
  return response.json();
}

// Moves teams to a place (slot null: Neraspoređene); returns the Podjela as saved and its warnings
export async function setNightSplitAPI(leagueId: number, date: string, teams: SplitMove[]): Promise<SplitResult> {
  const response = await apiFetch(`/api/leagues/${leagueId}/nights/${date}/split`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({teams}),
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Podjela nije spremljena."));
  return response.json();
}
