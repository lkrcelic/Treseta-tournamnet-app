import {REPEAT_MATCHUPS, RoundCreateRequest} from "@/app/_interfaces/round";
import {DRAFT_WAITING} from "@/app/_lib/roundStatus";
import {Slot} from "@/app/_lib/locations";
import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

// The rounds weren't created because some teams would meet twice today; repeats are their names, pair by pair
export class RepeatMatchupsError extends Error {
  constructor(message: string, readonly repeats: [string, string][]) {
    super(message);
  }
}

// The rounds weren't created because tonight's rounds still wait in Skica
export class DraftWaitingError extends Error {}

export async function createMultipleRoundsAPI(
  selectedLeagueId: number,
  teamIds: number[],
  numberOfRounds?: number,
  windowSize?: number,
  allowRepeats?: boolean,
  // the tables where smoking is allowed tonight (empty: none)
  smokingTables?: number[],
  withinConferences?: boolean,
  // the place of tonight's two-place night (null: one place)
  slot: Slot | null = null,
): Promise<{roundNumber: number; date: string}> {
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
      location_slot: slot,
    } as RoundCreateRequest),
  });
  if (response.status === 409) {
    const data = await response.clone().json().catch(() => null);
    if (data?.code === REPEAT_MATCHUPS) throw new RepeatMatchupsError(data.error, data.repeats ?? []);
    if (data?.code === DRAFT_WAITING) throw new DraftWaitingError(data.error);
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Kolo nije napravljeno."));
  }
  // the first new round's number and the night (YYYY-MM-DD) the drafts are on
  const data = await response.json();
  return {roundNumber: data.round_number, date: data.date};
}
