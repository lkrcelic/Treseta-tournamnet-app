import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {ResultResponse} from "@/app/_interfaces/result";

export async function getOngoingResultAPI(resultId: number): Promise<ResultResponse> {
    const response = await apiFetch(`/api/ongoing-result/${resultId}`);

    if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Igra se nije učitala."));
    }

    return response.json();
}
