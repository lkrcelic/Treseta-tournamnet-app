import {Role, rolesOf} from "./roles";

/**
 * What a role may do, in one map (DECISIONS #86). No RBAC tables: a new role is one line in BY_ROLE and nothing else
 * in the app changes. A capability says WHAT someone may do; whose tournament it is, is a separate layer
 * (ownership.ts), so the two never get mixed into one check.
 *
 * Framework free, so the client (useCan) and the server (requireCan) ask the same question of the same map.
 */
export type Capability =
  // tournaments
  | "tournament.create" // Novi turnir
  | "tournament.manage.own" // uredi, vodi, otkaži svoj turnir (+ ownership.ts)
  | "tournament.manage.all" // bilo čiji turnir
  | "tournament.delete" // Obriši turnir (nosi rezultate i rejting)
  // teams
  | "team.create"
  | "team.edit"
  | "team.delete"
  | "team.moderate" // Zabrani novu sliku ekipe
  // what someone sees of a player (privacy.ts)
  | "player.directory" // imenik Igrači: ime, ekipe
  | "player.contact" // + telefon
  | "player.private" // + username, email, datum rođenja, pušač
  // what someone does to a player
  | "player.manage" // uredi podatke, deaktiviraj, obriši
  | "player.role" // dodijeli rolu
  // the rest of the league
  | "ban.manage.own" // zabrana prijave na svom turniru
  | "ban.manage.all"
  | "league.manage"
  | "sponsor.manage"
  | "burza.moderate"
  | "rating.manage";

const ALL_CAPABILITIES: readonly Capability[] = [
  "tournament.create",
  "tournament.manage.own",
  "tournament.manage.all",
  "tournament.delete",
  "team.create",
  "team.edit",
  "team.delete",
  "team.moderate",
  "player.directory",
  "player.contact",
  "player.private",
  "player.manage",
  "player.role",
  "ban.manage.own",
  "ban.manage.all",
  "league.manage",
  "sponsor.manage",
  "burza.moderate",
  "rating.manage",
];

// A new role is one line here. The list is what that role may do, nothing more.
const BY_ROLE: Record<Role, readonly Capability[]> = {
  ADMIN: ALL_CAPABILITIES,
  ORGANIZER: [
    "tournament.create",
    "tournament.manage.own",
    "team.create",
    "team.edit",
    "player.directory",
    "player.contact",
    // not "ban.manage.own": Zabrana prijava is league wide (the API takes no tournament), so a ban stays the admin's
    // until it can be tied to one tournament
  ],
  // a player's own profile and their own team are not capabilities: they are theirs (requireUser plus the row's owner)
  PLAYER: [],
};

export type CapabilityUser = {player_role: string} | null | undefined;

export function can(user: CapabilityUser, cap: Capability): boolean {
  return rolesOf(user).some((role) => BY_ROLE[role].includes(cap));
}

// true for anyone who manages something — who therefore gets the management screens, each one still behind its own
// `can`. Being allowed in is not the same as being allowed everything inside.
export function canManageAnything(user: CapabilityUser): boolean {
  return rolesOf(user).some((role) => BY_ROLE[role].length > 0);
}

// For the tests and for a role label; not used to decide anything
export function capabilitiesOf(user: CapabilityUser): Capability[] {
  return ALL_CAPABILITIES.filter((cap) => can(user, cap));
}

export {ALL_CAPABILITIES};
