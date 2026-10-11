import {PAIRING_NOTICE, RoundCreateRequest, SameConferencePair} from "@/app/_interfaces/round";
import {responseErrorMessage} from "@/app/_fetchers/errorMessage";

// The rounds weren't created because the admin should see the pairing first: repeats are the pairs that would meet
// twice today, sameConference the tables with two teams of one conference (team names, pair by pair)
export class PairingNoticeError extends Error {
  constructor(
    message: string,
    readonly repeats: [string, string][],
    readonly sameConference: SameConferencePair[]
  ) {
    super(message);
  }
}

export async function createMultipleRoundsAPI(
  selectedLeagueId: number,
  teamIds: number[],
  numberOfRounds?: number,
  windowSize?: number,
  allowRepeats?: boolean,
  allowSameConference?: boolean,
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
      allowSameConference,
    } as RoundCreateRequest),
  });
  if (response.status === 409) {
    const data = await response.clone().json().catch(() => null);
    if (data?.code === PAIRING_NOTICE) throw new PairingNoticeError(data.error, data.repeats ?? [], data.same_conference ?? []);
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Failed to create rounds"));
  }
  const data = await response.json();
  return data.round_number;
}
