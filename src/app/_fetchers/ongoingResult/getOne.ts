import {ResultResponse} from "@/app/_interfaces/result";

export async function getOngoingResultAPI(resultId: number): Promise<ResultResponse> {
    const response = await fetch(`/api/ongoing-result/${resultId}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch the hand: ${response.statusText}`);
    }

    return response.json();
}
