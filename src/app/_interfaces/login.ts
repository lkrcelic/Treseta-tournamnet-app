import {z} from "zod";

export const LoginUser = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LoginUserInterface = z.infer<typeof LoginUser>;

// A deactivated account trying to log in: the 403 of POST /api/login, and /login?error=AccountDeactivated
export const ACCOUNT_DEACTIVATED = "Račun je deaktiviran. Javi se administratoru.";

// The /login?error= code of a deactivated account: a refused Google login (googleAuth.ts, callbacks.signIn) and an open
// login that ended because an admin deactivated the account (_bootstrap/sessionCheck.ts)
export const ACCOUNT_DEACTIVATED_CODE = "AccountDeactivated";

// A Google login whose email belongs to a player opened with a password: the email of such a row was never confirmed,
// so Google isn't linked to it until the player logs in with the password first (googleAuth.ts, _lib/auth/googleLink.ts)
export const PASSWORD_ACCOUNT_CODE = "PasswordAccount";

export const PASSWORD_ACCOUNT =
  "Račun s tim emailom je otvoren s korisničkim imenom i lozinkom. Prijavi se lozinkom, pa onda pritisni Prijava s Googleom — tako se Google veže na taj račun.";

// What Prijava shows for /login?error=<code>. Only the app's own codes mean a deactivated account or an email that
// already has a password account; every other code comes from NextAuth after a Google login failed or was cancelled
// (AccessDenied too: a database error in the signIn callback becomes AccessDenied, so it mustn't read as
// "deactivated").
export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === ACCOUNT_DEACTIVATED_CODE) return ACCOUNT_DEACTIVATED;
  if (code === PASSWORD_ACCOUNT_CODE) return PASSWORD_ACCOUNT;
  return "Prijava s Googleom nije uspjela. Pokušaj ponovno.";
}
