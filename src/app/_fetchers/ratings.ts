import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {PlayerRatingDetail, RatingsList} from "@/app/_interfaces/ratings";

export async function getRatingsAPI(): Promise<RatingsList> {
  const response = await apiFetch("/api/ratings");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Rejting se nije učitao."));
  return response.json();
}

// One player's rating; null when there is no such player (never existed, deleted, or never on a team)
export async function getPlayerRatingAPI(playerId: number): Promise<PlayerRatingDetail | null> {
  const response = await apiFetch(`/api/ratings/${playerId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Rejting igrača se nije učitao."));
  return response.json();
}
