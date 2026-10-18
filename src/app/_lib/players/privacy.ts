import {PlayerView} from "@/app/_interfaces/player";
import {PHOTO_BLOCKED_ERROR, PhotoVisibility} from "@/app/_interfaces/photo";
import {isAdminRole} from "./admin";
import {fullName} from "./names";

// Who sees which personal data of a player (handoff §6 "Privacy", enforced on the server). The player themselves and
// admins get everything. Everyone else gets the name and whether the account is active ("Neaktivan" is shown to all);
// the username, email, phone, birth date, smoker flag and admin role are left out of the response altogether.
// Rating, teams and results are public and come from their own queries. Framework free so it can be unit tested.

// The logged-in player looking at the page
export type Viewer = {id: number; player_role: string};

// The Player row fields the filter reads
export type PrivatePlayer = {
  id: number;
  first_name: string;
  last_name: string;
  active: boolean;
  username: string;
  email: string;
  phone: string | null;
  birth_date: Date | string | null;
  smoker: boolean;
  player_role: string;
};

// The player themselves or an admin
export function fullAccess(viewer: Viewer | null, playerId: number): boolean {
  return viewer != null && (viewer.id === playerId || isAdminRole(viewer));
}

export function playerView(p: PrivatePlayer, viewer: Viewer | null): PlayerView {
  const view: PlayerView = {id: p.id, first_name: p.first_name, last_name: p.last_name, name: fullName(p), active: p.active};
  if (!fullAccess(viewer, p.id)) return view;
  return {
    ...view,
    username: p.username,
    email: p.email,
    phone: p.phone,
    birth_date: isoDay(p.birth_date),
    smoker: p.smoker,
    is_admin: isAdminRole(p),
  };
}

// The username on a team roster row: for an admin and the player themselves; null for everyone else
export function rosterUsername(viewer: Viewer | null, playerId: number, username: string): string | null {
  return fullAccess(viewer, playerId) ? username : null;
}

// photo_url: the avatar, already filtered for the viewer (photos.ts)
export type RosterPlayer = {id: number; first_name: string; last_name: string; username: string; photo_url?: string | null};
// username: present only where rosterUsername allows it (the key is left out otherwise)
export type RosterEntry = {id: number; first_name: string; last_name: string; username?: string; photo_url?: string | null};

// A team's players as the viewer gets them (GET /api/teams, /api/teams/[id]): in Croatian name order, which the
// database's collation doesn't give ("Č" after "Z", lowercase after every capital), and with the username only for
// an admin and the player themselves
export function rosterView(viewer: Viewer | null, players: RosterPlayer[]): RosterEntry[] {
  return players
    .map(({username, ...p}) => {
      const shown = rosterUsername(viewer, p.id, username);
      return shown == null ? p : {...p, username: shown};
    })
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "hr"));
}

// A round's lineup (GET /api/rounds/[id]/lineup) lists both teams with their usernames, for Tko igra ovu rundu?, which
// opens while the round is still to be played: a player of the round gets it only then (the route checks that they
// play it), an admin always. A finished round's rosters would give away the opponents' usernames for every past round.
export function lineupVisible(viewer: Viewer, round: {open: boolean}): boolean {
  return round.open || isAdminRole(viewer);
}

// ---------- profile photos ----------
// Who sees a photo: the player (or team member) and admins always; otherwise as its owner chose: ALL (any logged-in
// player), TEAMMATES (players who share a team with the player; for a team, its own players) or ME (nobody else). Whoever
// may not see it gets the initials or the team's letter, and the server sends them no address for it (a request for
// the address itself is a 404).

export type PhotoOwner = {id: number; photo_visibility: PhotoVisibility};

// viewerTeammates: ids of the players who share at least one team with the viewer (one query per request, photos.ts)
export function playerPhotoVisible(viewer: Viewer | null, owner: PhotoOwner, viewerTeammates: ReadonlySet<number>): boolean {
  if (viewer == null) return false;
  if (fullAccess(viewer, owner.id)) return true;
  if (owner.photo_visibility === "ALL") return true;
  if (owner.photo_visibility === "TEAMMATES") return viewerTeammates.has(owner.id);
  return false;
}

// viewerTeamIds: the teams the viewer plays in
export function teamPhotoVisible(viewer: Viewer | null, team: {photo_visibility: PhotoVisibility}, viewerTeamIds: ReadonlySet<number>, teamId: number): boolean {
  if (viewer == null) return false;
  if (isAdminRole(viewer) || team.photo_visibility === "ALL") return true;
  // TEAMMATES: the team's own players (ME isn't a team's choice; a database CHECK keeps it out)
  return viewerTeamIds.has(teamId);
}

// The photo's address, with its version so a new photo is a new address (cached for good, PHOTO_CACHE); null when there
// is none or the viewer may not see it
export function playerPhotoUrl(
  p: PhotoOwner & {photo_updated_at: Date | null},
  viewer: Viewer | null,
  viewerTeammates: ReadonlySet<number>
): string | null {
  if (p.photo_updated_at == null || !playerPhotoVisible(viewer, p, viewerTeammates)) return null;
  return `/api/players/${p.id}/photo?v=${p.photo_updated_at.getTime()}`;
}

export function teamPhotoUrl(
  t: {team_id: number; photo_visibility: PhotoVisibility; photo_updated_at: Date | null},
  viewer: Viewer | null,
  viewerTeamIds: ReadonlySet<number>
): string | null {
  if (t.photo_updated_at == null || !teamPhotoVisible(viewer, t, viewerTeamIds, t.team_id)) return null;
  return `/api/teams/${t.team_id}/photo?v=${t.photo_updated_at.getTime()}`;
}

export const PHOTO_SELF_ONLY = "Sliku može postaviti samo igrač na svom profilu.";
export const PHOTO_MEMBERS_ONLY = "Sliku ekipe mogu mijenjati samo njezini igrači.";

// Why the viewer may not change a player's photo (403), or null when they may. "set" (a new photo) is the player's
// alone, and not while an admin has blocked it; "remove" is the player's or an admin's (without telling the player).
export function playerPhotoChangeError(viewer: Viewer, owner: {id: number; photo_blocked: boolean}, action: "set" | "remove"): string | null {
  if (action === "remove") return fullAccess(viewer, owner.id) ? null : PHOTO_SELF_ONLY;
  if (viewer.id !== owner.id) return PHOTO_SELF_ONLY;
  return owner.photo_blocked ? PHOTO_BLOCKED_ERROR : null;
}

// The same for a team: any of its players sets a photo (unless blocked) and removes it; an admin only removes it
export function teamPhotoChangeError(viewer: Viewer, team: {photo_blocked: boolean}, member: boolean, action: "set" | "remove"): string | null {
  if (action === "remove") return member || isAdminRole(viewer) ? null : PHOTO_MEMBERS_ONLY;
  if (!member) return PHOTO_MEMBERS_ONLY;
  return team.photo_blocked ? PHOTO_BLOCKED_ERROR : null;
}

function isoDay(d: Date | string | null): string | null {
  if (d == null) return null;
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
