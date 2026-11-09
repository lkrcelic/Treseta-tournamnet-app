import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {HANDS_CHANGED_CODE} from "@/app/_lib/validation/validateResult";

// The server's question, not a refusal: a hand was saved from another phone while this one was entering its own
// (409, code "hands_changed"). `hands` is how many hands the match holds now; the wizard asks and, on "Upiši i ovu",
// sends the same hand again without expected_hands.
export class HandsChangedError extends Error {
  constructor(message: string, readonly hands: number | null) {
    super(message);
    this.name = "HandsChangedError";
  }
}

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

    if (response.status === 409) {
        const answer = await response.json().catch(() => null);
        const message = typeof answer?.error === "string" ? answer.error : "Igra nije spremljena.";
        throw answer?.code === HANDS_CHANGED_CODE
            ? new HandsChangedError(message, typeof answer?.hands === "number" ? answer.hands : null)
            : new Error(message);
    }

    if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Igra nije spremljena."));
    }

    return response.json();
}
