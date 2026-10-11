import {responseErrorMessage} from "@/app/_fetchers/errorMessage";

// ongoingScore: the running match's points, team1 first (null before a match is started); hasLineup: who plays the
// round is already confirmed
export async function getOpenRoundByPlayerIdAPI(): Promise<{roundId: number, ongoingMatchId: number | null, hasLineup: boolean, ongoingScore: [number, number] | null}> {
  const response = await fetch(`/api/rounds/open`);

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to fetch round"));
  }

  return response.json();
}
