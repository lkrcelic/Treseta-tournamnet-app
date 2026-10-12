import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

type CreateOngoingResultAPIProps = {
    result: unknown;
}

// Saves a new hand; returns its id
export async function createOngoingResultAPI({result}: CreateOngoingResultAPIProps): Promise<{result_id: number}> {
    const response = await apiFetch(`/api/ongoing-result`, {
        method: "POST",
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
