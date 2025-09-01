import {OngoingMatchResponseValidation} from "@/app/_interfaces/match";

export async function getOngoingMatchAPI(matchId: number): Promise<OngoingMatchResponseValidation> {
    const response = await fetch(`/api/ongoing-matches/${matchId}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch ongoing match: ${response.statusText}`);
    }

    return response.json();
}