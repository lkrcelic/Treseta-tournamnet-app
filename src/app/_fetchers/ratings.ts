import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {PlayerRatingDetail, RatingsList} from "@/app/_interfaces/ratings";

export async function getRatingsAPI(): Promise<RatingsList> {
  const response = await apiFetch("/api/ratings");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Rejting se nije učitao."));
  return response.json();
}

export async function getPlayerRatingAPI(playerId: number): Promise<PlayerRatingDetail> {
  const response = await apiFetch(`/api/ratings/${playerId}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Rejting igrača se nije učitao."));
  return response.json();
}
