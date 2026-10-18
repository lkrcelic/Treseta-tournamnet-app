import {AdminPlayerRow, PLAYER_NOT_FOUND} from "@/app/_interfaces/player";
import {displayName} from "./names";

// The admin rules the server enforces (handoff §6 "Admin checks"). requireAdmin answers with adminCheck, and the
// admin player endpoints refuse with adminActionError. Framework free so it can be unit tested.

const ADMIN_ROLE = "ADMIN";

export function isAdminRole(user: {player_role: string} | null | undefined): boolean {
  return user?.player_role === ADMIN_ROLE;
}

// null = an admin may go on; "unauthorized" = nobody is logged in (401); "forbidden" = not an admin (403)
export type AdminCheck = "unauthorized" | "forbidden" | null;

export function adminCheck(user: {player_role: string} | null | undefined): AdminCheck {
  if (!user) return "unauthorized";
  return isAdminRole(user) ? null : "forbidden";
}

// What an admin does to a player in "Uredi osobne podatke": change the details, take away the admin role,
// deactivate, activate again or delete (anonymise)
export type AdminAction = "update" | "demote" | "deactivate" | "activate" | "delete";

export const ADMIN_ACTION_ERROR = {
  selfDeactivate: "Ne možeš deaktivirati svoj račun.",
  selfDelete: "Ne možeš obrisati sam sebe.",
  selfDemote: "Ne možeš sebi ukloniti administratorska prava.",
  lastAdmin: "Mora ostati barem jedan administrator.",
} as const;

export type AdminTarget = {id: number; player_role: string; active: boolean; deleted_at: Date | string | null};

/**
 * Why the admin `viewer` can't do `action` to `target`, or null when they can. A missing or deleted player is
 * PLAYER_NOT_FOUND (a 404); the other messages are a 400. `adminCount` is the number of active admins, the target
 * included: the league is never left without one.
 */
export function adminActionError(
  viewer: {id: number},
  target: AdminTarget | null,
  action: AdminAction,
  {adminCount}: {adminCount: number}
): string | null {
  if (!target || target.deleted_at != null) return PLAYER_NOT_FOUND;
  const self = viewer.id === target.id;
  if (action === "deactivate" && self) return ADMIN_ACTION_ERROR.selfDeactivate;
  if (action === "delete" && self) return ADMIN_ACTION_ERROR.selfDelete;
  if (action === "demote" && self) return ADMIN_ACTION_ERROR.selfDemote;
  // each of these takes an admin away
  const removesAdmin = action === "demote" || action === "deactivate" || action === "delete";
  if (removesAdmin && isAdminRole(target) && target.active && adminCount <= 1) return ADMIN_ACTION_ERROR.lastAdmin;
  return null;
}

// --- Delete (anonymise) -------------------------------------------------------------------------------------------

// What a deleted player is called everywhere their name still shows: lineups, Burza ("suigrač: Obrisani igrač")
const DELETED_PLAYER_NAME = {first_name: "Obrisani", last_name: "igrač"} as const;

/**
 * The update that turns a deleted player's row into "Obrisani igrač" (DELETE /api/admin/players/[id]). The row stays,
 * so the rounds they played, their lineups and rating history keep their player and everyone else's rating stays the
 * same; nothing personal is left and nobody can log in with it (no password, inactive). The username and email stay
 * unique: `attempt` > 1 only when someone already took the plain one. The rating columns are left as they are.
 */
export function anonymisedPlayerData(id: number, now: Date, attempt = 1) {
  const again = attempt > 1 ? attempt : null;
  return {
    ...DELETED_PLAYER_NAME,
    // a-z, digits and "_", so it follows the username rules (validation/username.ts) like any other
    username: again ? `obrisani_${id}_${again}` : `obrisani_${id}`,
    // .invalid never receives mail
    email: again ? `obrisani-${id}-${again}@deleted.invalid` : `obrisani-${id}@deleted.invalid`,
    password_hash: "",
    phone: null,
    birth_date: null,
    // NextAuth's copies of the Google profile
    image: null,
    name: null,
    emailVerified: null,
    smoker: false,
    smoker_answered: true,
    // the profile photo goes too (its bytes: PlayerPhoto, deleted with the row by anonymisePlayer)
    photo_updated_at: null,
    photo_visibility: "ALL" as const,
    photo_blocked: false,
    player_role: "PLAYER" as const,
    active: false,
    deleted_at: now,
  };
}

// --- The admin directory ------------------------------------------------------------------------------------------

type DirectoryPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  active: boolean;
  teams: {team_id: number; team_name: string}[];
  // the admin's phone Igrači list shows them (admin-mobile 34)
  admin?: boolean;
  rating?: number;
  // the avatar (an admin sees every photo)
  photo_url?: string | null;
};

// The Igrači directory rows (GET /api/admin/players): by name in Croatian order (the database's collation puts "Č"
// after "Z"), each with their teams in the same order
export function adminPlayerRows(players: DirectoryPlayer[]): AdminPlayerRow[] {
  const hr = (a: string, b: string) => a.localeCompare(b, "hr");
  return players
    .map((p) => ({...p, name: displayName(p), teams: [...p.teams].sort((a, b) => hr(a.team_name, b.team_name))}))
    .sort((a, b) => hr(a.name, b.name) || a.id - b.id);
}
