export type FinishMatchOutcome = {
    roundId: number | null;
    roundFinished: boolean;
    nextOngoingMatchId: number | null;
};

export class MatchAlreadyFinishedError extends Error {}

// Finishes the ongoing match; the server says whether the next match starts or the round is over.
export async function createMatchAPI(ongoingMatch: number): Promise<FinishMatchOutcome> {
    const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ongoingMatch),
    });

    if (response.status === 409) {
        throw new MatchAlreadyFinishedError("The match was already finished on another device.");
    }
    if (!response.ok) {
        throw new Error(`Failed to store match: ${response.statusText}`);
    }
    return response.json();
}
