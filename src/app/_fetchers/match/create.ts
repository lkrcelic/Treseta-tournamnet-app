export async function createMatchAPI(ongoingMatch: number): Promise<void> {
    const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ongoingMatch),
    });

    if (!response.ok) {
        throw new Error(`Failed to store match: ${response.statusText}`);
    }
}