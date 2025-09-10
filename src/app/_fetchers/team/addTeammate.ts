export async function addTeammateAPI(team_id: number, player_id: number): Promise<void> {
    const res = await fetch("/api/teams/add-teammate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id, player_id }),
    });
  
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to add teammate: ${res.status} ${text}`);
    }
  }