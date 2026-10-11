import {RoundExtendedResponse} from "@/app/_interfaces/round";

// ongoing_match_id: the match being played in the round right now, if any
export async function getRoundDataAPI(roundId: number): Promise<RoundExtendedResponse & {ongoing_match_id?: number | null}> {
    const response = await fetch(`/api/rounds/${roundId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch team data: ${response.statusText}`);
    }
    return response.json();
}