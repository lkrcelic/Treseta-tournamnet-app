// The "Bye" team that a team without an opponent plays against. The standings SQL functions expect it to be team 0.
export const BYE_TEAM_ID: number = Number(process.env.BYE_ID ?? 0) || 0;

export function isByeTeam(teamId: number): boolean {
  return teamId === BYE_TEAM_ID;
}

// What the bye's side of a table is called on screen ("Slobodna runda", as in the upute and the server's messages);
// the team row in the database keeps its old name "Bye"
export const BYE_LABEL = "Slobodna runda";

// A team's name as shown at a table: the bye's side reads "Slobodna runda", any other team its own name
export function teamLabel(teamId: number | null | undefined, name: string): string {
  return teamId != null && isByeTeam(teamId) ? BYE_LABEL : name;
}
