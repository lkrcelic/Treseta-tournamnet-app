import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {RoundExtendedResponse} from "@/app/_interfaces/round";

// ongoing_match_id: the match being played in the round right now, if any
export async function getRoundDataAPI(roundId: number): Promise<RoundExtendedResponse & {ongoing_match_id?: number | null}> {
    const response = await apiFetch(`/api/rounds/${roundId}`);
    if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Runda se nije učitala."));
    }
    return response.json();
}