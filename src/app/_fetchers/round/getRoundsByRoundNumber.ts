import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import type {RoundMatchup} from "@/app/_lib/service/round/getRoundMatchups";

// The tables of one round number of a league (round numbers count up per league)
export async function getRoundsByRoundNumber(roundNumber: number, leagueId: number): Promise<RoundMatchup[]> {
  if (!roundNumber || roundNumber <= 0) return [];
  const response = await fetch(`/api/roundMatchups/${roundNumber}?league_id=${leagueId}`);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to fetch the pairings"));
  }
  return response.json();
}
