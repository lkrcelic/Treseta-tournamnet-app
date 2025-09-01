
export async function finishRoundAPI(roundId: number): Promise<void> {
  const response = await fetch(`/api/rounds/${roundId}/finish`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
  });
  if (!response.ok) {
    throw new Error(`Failed to finish round: ${response.statusText}`);
  }
  return;
}
