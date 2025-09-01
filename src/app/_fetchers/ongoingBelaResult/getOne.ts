import {BelaResultResponse} from "@/app/_interfaces/belaResult";

export async function getOngoingBelaResultAPI(resultId: number): Promise<BelaResultResponse> {
    const response = await fetch(`/api/ongoing-bela-result/${resultId}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch ongoing bela result: ${response.statusText}`);
    }

    return response.json();
}