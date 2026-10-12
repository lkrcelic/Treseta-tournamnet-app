import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {OngoingMatchExtendedResponse} from "@/app/_interfaces/match";

// The match no longer exists: it was finished (possibly on another phone)
export class OngoingMatchGoneError extends Error {}

export async function getOngoingMatchAPI(matchId: number): Promise<OngoingMatchExtendedResponse> {
  const response = await apiFetch(`/api/ongoing-matches/${matchId}`);

  if (response.status === 404) {
    throw new OngoingMatchGoneError("Ovaj meč je završen.");
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Meč se nije učitao."));
  }

  return response.json();
}
