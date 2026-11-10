import {can, CapabilityUser} from "./permissions";

// Whose tournament it is. A capability says what someone may do (permissions.ts), this says on which tournament —
// the second, separate layer (DECISIONS #86). Framework free: the routes, the services and the client all ask this.

// Everything this needs of a tournament. `created_by` is null for the tournaments made before the organizer role
// came in: nobody owns them, so only an admin touches them.
export type OwnedTournament = {created_by: number | null};

export const NOT_YOUR_TOURNAMENT = "Ovo nije tvoj turnir.";

export function canManageTournament(user: (CapabilityUser & {id: number}) | null | undefined, tournament: OwnedTournament): boolean {
  if (!user) return false;
  if (can(user, "tournament.manage.all")) return true;
  return can(user, "tournament.manage.own") && tournament.created_by === user.id;
}

// "Moji turniri": which tournaments the organizer's own lists are narrowed to. null = every tournament (an admin).
export function ownTournamentFilter(user: (CapabilityUser & {id: number}) | null | undefined): {created_by: number} | null {
  if (!user || can(user, "tournament.manage.all")) return null;
  return {created_by: user.id};
}
