import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {PlayerOverview} from "@/app/_interfaces/profiles";

// The Player page; null when there is no such player (never existed, or deleted: 404)
export async function getPlayerOverviewAPI(playerId: number): Promise<PlayerOverview | null> {
  const response = await apiFetch(`/api/players/${playerId}/overview`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Igrač se nije učitao."));
  return response.json();
}
