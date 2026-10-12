import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

export async function getLeagueStandingsByDateAPI(leagueId: number, date?: string): Promise<unknown> {
  const url = new URL(`/api/leagues/${leagueId}/daily-standings`, window.location.origin);
  
  if (date) {
    url.searchParams.append('date', date);
  }
  
  const response = await apiFetch(url.toString());

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Poredak se nije učitao."));
  }

  return response.json();
}
