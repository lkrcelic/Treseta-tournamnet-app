// How a player's name is shown. Framework free (and import free), so client screens and the server share it.

// (the fields are optional for the client's partial player types; a missing one counts as empty)
type Named = {first_name?: string | null; last_name?: string | null};

export function fullName(p: Named): string {
  return `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
}

// A name to show for a player who may have none (a Google sign-up without one): never the username, which is private
export const NAMELESS_PLAYER = "Igrač bez imena";

export function displayName(p: Named): string {
  return fullName(p) || NAMELESS_PLAYER;
}
