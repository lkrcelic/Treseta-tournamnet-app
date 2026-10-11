import {REPEAT_MATCHUPS, RoundCreateRequest} from "@/app/_interfaces/round";
import {responseErrorMessage} from "@/app/_fetchers/errorMessage";

// The rounds weren't created because some teams would meet twice today; repeats are their names, pair by pair
export class RepeatMatchupsError extends Error {
  constructor(message: string, readonly repeats: [string, string][]) {
    super(message);
  }
}

export async function createMultipleRoundsAPI(
  selectedLeagueId: number,
  teamIds: number[],
  numberOfRounds?: number,
  windowSize?: number,
  allowRepeats?: boolean,
): Promise<number> {
  const response = await fetch("/api/rounds/generate-multiple", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      league_id: selectedLeagueId,
      present_teams: teamIds,
      numberOfRounds,
      windowSize,
      allowRepeats,
    } as RoundCreateRequest),
  });
  if (response.status === 409) {
    const data = await response.clone().json().catch(() => null);
    if (data?.code === REPEAT_MATCHUPS) throw new RepeatMatchupsError(data.error, data.repeats ?? []);
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to create rounds"));
  }
  const data = await response.json();
  return data.round_number;
}
