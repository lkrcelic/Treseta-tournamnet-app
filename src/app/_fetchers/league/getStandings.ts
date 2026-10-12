import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

export async function getLeagueStandingsAPI(leagueId: number): Promise<unknown> {
  const response = await apiFetch(`/api/leagues/${leagueId}/standings`);

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Poredak se nije učitao."));
  }

  return response.json();
}
