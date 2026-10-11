// How long a login lasts, for password (Lucia) and Google (NextAuth) sessions alike.
// The session is sliding: every app load (/api/auth/me) pushes the expiry out again and re-issues the cookie,
// so a player who opens the app at least once a month never has to log in again.
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const googleSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
