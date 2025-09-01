export async function getActiveOrCreateMatchByPlayerIdAPI(): Promise<{ id: number }> {
  // 1) Try to get existing active match (no side effects)
  const getRes = await fetch(`/api/matches/active`, { cache: 'no-store' });
  if (getRes.ok) {
    return getRes.json();
  }

  if (getRes.status !== 404) {
    console.error(`No active match found: ${getRes.status} ${getRes.statusText}`);
  }

  // 2) If none exists, create one (side effect)
  const postRes = await fetch(`/api/matches/create`, { method: 'POST' });
  if (!postRes.ok) {
    console.error(`Failed to open match: ${postRes.status} ${postRes.statusText}`);
  }
  return postRes.json();
}
