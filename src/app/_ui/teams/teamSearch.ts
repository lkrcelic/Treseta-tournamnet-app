import {searchTeamsAPI} from "@/app/_fetchers/team/searchTeams";

// A team found by name (Manage League's "Add team")
export type TeamOption = {id: number; title: string; subtitle?: string; players: string[]};

export async function searchTeams(q: string): Promise<TeamOption[]> {
  const found = await searchTeamsAPI(q);
  return found.map((t) => {
    const players = (t.teamPlayers ?? []).map((tp) => tp.player.username);
    return {id: t.team_id, title: t.team_name, subtitle: players.join(" · ") || undefined, players};
  });
}
