import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

// slot: one place of a two-place night (its teams, ranked from 1)
export async function getLeagueStandingsByDateAPI(leagueId: number, date?: string, slot: number | null = null): Promise<unknown> {
  const url = new URL(`/api/leagues/${leagueId}/daily-standings`, window.location.origin);
  
  if (date) {
    url.searchParams.append('date', date);
  }
  if (slot != null) url.searchParams.append("slot", String(slot));
  
  const response = await apiFetch(url.toString());

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Poredak se nije učitao."));
  }

  return response.json();
}
