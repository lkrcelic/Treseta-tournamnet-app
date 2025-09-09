export async function getActiveOrCreateMatchByPlayerIdAPI(): Promise<{id: number}> {
  
  // 0) Fetch opened round (no side effects)
  const roundRes = await fetch(`/api/rounds/opened`, {cache: "no-store"});
  if (!roundRes.ok) {
    throw new Error(`Failed to fetch opened round by player id: ${roundRes.status} ${roundRes.statusText}`);
  }

  const round = await roundRes.json();

  // 1) Try to get existing active match (no side effects)
  const getRes = await fetch(`/api/matches/active`, {cache: "no-store"});
  if (getRes.ok) {
    return getRes.json();
  }

  if (getRes.status !== 404) {
    console.error(`No active match found: ${getRes.status} ${getRes.statusText}`);
  }

  // 2) If none exists, create one (side effect)
  const postRes = await fetch(
    `/api/matches/create`,
    {method: "POST", body: JSON.stringify({round_id: round.id, score_threshold: 41})}
  );

  if (!postRes.ok) {
    console.error(`Failed to open match: ${postRes.status} ${postRes.statusText}`);
    throw new Error(`Failed to open match: ${postRes.status} ${postRes.statusText}`);
  }
  return postRes.json();
}
