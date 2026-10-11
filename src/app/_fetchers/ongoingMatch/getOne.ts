import {OngoingMatchExtendedResponse} from "@/app/_interfaces/match";

// The match no longer exists: it was finished (possibly on another phone)
export class OngoingMatchGoneError extends Error {}

export async function getOngoingMatchAPI(matchId: number): Promise<OngoingMatchExtendedResponse> {
  const response = await fetch(`/api/ongoing-matches/${matchId}`);

  if (response.status === 404) {
    throw new OngoingMatchGoneError(`Ongoing match ${matchId} is finished.`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ongoing match: ${response.statusText}`);
  }

  return response.json();
}
