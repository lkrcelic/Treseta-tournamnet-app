export async function getAllMatchesByRoundIdAPI(roundId: number): Promise<unknown> {
  const response = await fetch(`/api/rounds/${roundId}/matches`);
  if (!response.ok) {
    throw new Error(`Failed to fetch round matches: ${response.statusText}`);
  }
  return response.json();
}