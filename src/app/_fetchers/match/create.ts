export async function createMatchAPI(round_id: number, score_threshold: number): Promise<{id: number}> {
    const response = await fetch("/api/matches/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({round_id: round_id, score_threshold: score_threshold}),
    });

    if (!response.ok) {
        throw new Error(`Failed to create match: ${response.statusText}`);
    }

    return response.json();
}