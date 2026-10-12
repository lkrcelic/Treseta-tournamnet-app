import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import type {RoundMatchup} from "@/app/_lib/service/round/getRoundMatchups";

// The tables of one round number of a league (round numbers count up per league)
export async function getRoundsByRoundNumber(roundNumber: number, leagueId: number): Promise<RoundMatchup[]> {
  if (!roundNumber || roundNumber <= 0) return [];
  const response = await apiFetch(`/api/roundMatchups/${roundNumber}?league_id=${leagueId}`);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Parovi se nisu učitali."));
  }
  return response.json();
}
