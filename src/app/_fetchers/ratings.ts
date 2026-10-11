import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {PlayerRatingDetail, RatingsList} from "@/app/_interfaces/ratings";

export async function getRatingsAPI(): Promise<RatingsList> {
  const response = await fetch("/api/ratings");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to load the ratings"));
  return response.json();
}

export async function getPlayerRatingAPI(playerId: number): Promise<PlayerRatingDetail> {
  const response = await fetch(`/api/ratings/${playerId}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Failed to load the player's rating"));
  return response.json();
}
