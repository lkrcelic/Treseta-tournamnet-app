import {REPEAT_MATCHUPS, RoundCreateRequest} from "@/app/_interfaces/round";
import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

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
  // the tables where smoking is allowed tonight (empty: none)
  smokingTables?: number[],
  withinConferences?: boolean,
): Promise<number> {
  const response = await apiFetch("/api/rounds/generate-multiple", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      league_id: selectedLeagueId,
      present_teams: teamIds,
      numberOfRounds,
      windowSize,
      allowRepeats,
      smoking_tables: smokingTables,
      withinConferences,
    } as RoundCreateRequest),
  });
  if (response.status === 409) {
    const data = await response.clone().json().catch(() => null);
    if (data?.code === REPEAT_MATCHUPS) throw new RepeatMatchupsError(data.error, data.repeats ?? []);
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Kolo nije napravljeno."));
  }
  const data = await response.json();
  return data.round_number;
}
