export async function finishMatchAPI(matchId: number): Promise<void> {
    const response = await fetch("/api/matches/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({matchId: matchId}),
    });

    if (!response.ok) {
        throw new Error(`Failed to finish match: ${response.statusText}`);
    }
}