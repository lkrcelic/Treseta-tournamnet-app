// The rules for a new username, shared by the Profile edit field and PATCH /api/players/[id].
// Older usernames (e.g. made from a Google email) may break them; they only apply when a player picks a new one.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export const USERNAME_TAKEN = "This username is taken.";

// Usernames are stored lowercase without spaces: " Marko.B " -> "marko.b"
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

// The message for a username that can't be used, or undefined when it can (whether it's taken is asked separately)
export function usernameError(value: string): string | undefined {
  const username = normalizeUsername(value);
  if (!username) return "Username is required.";
  if (username.length < USERNAME_MIN) return "At least 3 characters.";
  if (username.length > USERNAME_MAX) return "At most 20 characters.";
  if (!USERNAME_PATTERN.test(username)) return "Only letters a–z, numbers, dot and underscore.";
  return undefined;
}
