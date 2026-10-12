import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

type UpdateOngoingResultAPIProps = {
    resultId: string | string[];
    result: unknown;
}

export async function updateOngoingResultAPI({resultId, result}: UpdateOngoingResultAPIProps): Promise<{message: string}> {
    const response = await apiFetch(`/api/ongoing-result/${resultId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({...(result as object)}),
    });

    if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Igra nije spremljena."));
    }

    return response.json();
}
