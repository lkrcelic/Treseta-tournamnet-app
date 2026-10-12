import {PLAYER_NOT_FOUND} from "@/app/_interfaces/player";

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
