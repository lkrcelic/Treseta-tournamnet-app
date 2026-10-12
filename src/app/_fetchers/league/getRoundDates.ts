import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

export async function getRoundDatesByLeagueIdAPI(leagueId: number): Promise<string[]> {
  const url = new URL(`/api/leagues/${leagueId}/round-dates`, window.location.origin);
  const response = await apiFetch(url.toString());
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Datumi kola se nisu učitali."));
  }
  return response.json();
}
