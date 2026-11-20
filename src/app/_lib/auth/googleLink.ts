// Whether a Google login may open an existing player, and may be linked to one that was opened with a password.
//
// A password sign-up takes any email without confirming it, so the email on such a row proves nothing: whoever
// registered first with someone else's address would otherwise catch that person's Google login (NextAuth's
// `allowDangerousEmailAccountLinking` links by email), keep the password, and sit in the account with their name,
// rating, team and phone number. So the link to a row that has a password is only made for someone who can already
// log in to that row — the player logged in with the password in this browser. Rows without a password (made by a
// Google login, by the seed or by an admin) have nothing to abuse and are linked as before. A Google account that is
// already linked goes to its own player, whatever its email.

export type GoogleLinkFacts = {
  // the player of the Account row of this Google account, if it was linked before
  linked: {active: boolean} | null;
  // the player NextAuth would link by email (ignoring case, the oldest first, as the adapter's getUserByEmail)
  byEmail: {id: number; active: boolean; hasPassword: boolean} | null;
  // the player logged in with a password in this browser: proof that a password row is theirs
  sessionPlayerId: number | null;
};

export type GoogleLinkDecision = "allow" | "deactivated" | "password_account";

export function googleLinkDecision({linked, byEmail, sessionPlayerId}: GoogleLinkFacts): GoogleLinkDecision {
  // linked before: the email doesn't come into it any more (a deleted player's email was replaced and their link
  // removed, so their Google login starts a new account)
  if (linked) return linked.active ? "allow" : "deactivated";
  // a new email makes a new player, which may log in
  if (!byEmail) return "allow";
  if (!byEmail.active) return "deactivated";
  if (!byEmail.hasPassword) return "allow";
  return sessionPlayerId === byEmail.id ? "allow" : "password_account";
}
