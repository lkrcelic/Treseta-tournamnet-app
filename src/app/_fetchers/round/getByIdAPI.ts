import {RoundExtendedResponse} from "@/app/_interfaces/round";

export async function getRoundByIdAPI(roundId: number): Promise<RoundExtendedResponse> {
    const response = await fetch(`/api/rounds/${roundId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch team data: ${response.statusText}`);
    }
    return response.json();
}