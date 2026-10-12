import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

export type FinishMatchOutcome = {
    roundId: number | null;
    roundFinished: boolean;
    nextOngoingMatchId: number | null;
};

export class MatchAlreadyFinishedError extends Error {}

// Finishes the ongoing match; the server says whether the next match starts or the round is over.
export async function createMatchAPI(ongoingMatch: number): Promise<FinishMatchOutcome> {
    const response = await apiFetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ongoingMatch),
    });

    if (response.status === 409) {
        throw new MatchAlreadyFinishedError("Meč je već završen na drugom uređaju.");
    }
    if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Meč nije spremljen."));
    }
    return response.json();
}
