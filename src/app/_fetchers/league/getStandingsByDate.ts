export async function getLeagueStandingsByDateAPI(leagueId: number, date?: string): Promise<unknown> {
  const url = new URL(`/api/leagues/${leagueId}/daily-standings`, window.location.origin);
  
  if (date) {
    url.searchParams.append('date', date);
  }
  
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch league table: ${response.statusText}`);
  }

  return response.json();
}
