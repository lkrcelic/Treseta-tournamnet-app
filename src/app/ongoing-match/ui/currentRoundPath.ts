import {getRoundDataAPI} from "@/app/_fetchers/round/getOne";

// Where someone following this round should be now: its running match, or the round result once it is over.
export async function currentRoundPath(roundId: number): Promise<string> {
  try {
    const round = await getRoundDataAPI(roundId);
    if (round.ongoing_match_id) {
      return `/ongoing-match/${round.ongoing_match_id}`;
    }
  } catch {
    // fall back to the result page
  }
  return `/round/${roundId}/result`;
}
