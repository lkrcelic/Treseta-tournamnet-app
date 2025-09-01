export async function getOpenRoundByPlayerIdAPI() {
  const response = await fetch(`/api/rounds/open`);

  if (!response.ok) {
    throw new Error(`Failed to fetch round: ${response.statusText}`);
  }

  return response.json();
}