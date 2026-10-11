// The "Bye" team that a team without an opponent plays against. The standings SQL functions expect it to be team 0.
export const BYE_TEAM_ID: number = Number(process.env.BYE_ID ?? 0) || 0;

export function isByeTeam(teamId: number): boolean {
  return teamId === BYE_TEAM_ID;
}
