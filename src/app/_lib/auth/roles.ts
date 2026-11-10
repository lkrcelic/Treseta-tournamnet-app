// Who a player is. ADMIN runs the league, ORGANIZER makes tournaments and runs their own (DECISIONS #86), PLAYER
// plays. What each one may do is in permissions.ts, not here.
export type Role = "ADMIN" | "ORGANIZER" | "PLAYER";

export const ROLES: readonly Role[] = ["ADMIN", "ORGANIZER", "PLAYER"];

/**
 * THE ONLY PLACE IN THE CODE THAT READS `player_role`. Everything else asks `can(user, …)`.
 *
 * A player has one role today, so this returns a list of one. If several roles per player are ever wanted, this
 * function is the only thing that changes (it returns the rows of a join table instead) — no route, no screen.
 */
export function rolesOf(user: {player_role: string} | null | undefined): Role[] {
  if (!user) return [];
  const role = user.player_role as Role;
  return ROLES.includes(role) ? [role] : [];
}

// For a label and for the role picker; the database never holds these words
export const ROLE_NAME: Record<Role, string> = {
  ADMIN: "Admin",
  ORGANIZER: "Organizator",
  PLAYER: "Igrač",
};
