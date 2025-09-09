export async function getRoundDatesByLeagueIdAPI(leagueId: number): Promise<string[]> {
  const url = new URL(`/api/leagues/${leagueId}/round-dates`, window.location.origin);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch round dates: ${response.statusText}`);
  }
  return response.json();
}
