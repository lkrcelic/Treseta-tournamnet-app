import {PlayerView} from "@/app/_interfaces/player";
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

export type RosterPlayer = {id: number; first_name: string; last_name: string; username: string};
// username: present only where rosterUsername allows it (the key is left out otherwise)
export type RosterEntry = {id: number; first_name: string; last_name: string; username?: string};

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

function isoDay(d: Date | string | null): string | null {
  if (d == null) return null;
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
