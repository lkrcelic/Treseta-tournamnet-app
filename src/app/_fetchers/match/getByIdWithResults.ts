import {MatchExtendedResponse} from "@/app/_interfaces/match";

export async function getMatchByIdWithResultsAPI(matchId: number): Promise<MatchExtendedResponse> {
    const response = await fetch(`/api/matches/${matchId}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch match: ${response.statusText}`);
    }

    return response.json();
}