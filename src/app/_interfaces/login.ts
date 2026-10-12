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

// What Prijava shows for /login?error=<code>. Only ACCOUNT_DEACTIVATED_CODE means a deactivated account; every other
// code comes from NextAuth after a Google login failed or was cancelled (AccessDenied too: a database error in the
// signIn callback becomes AccessDenied, so it mustn't read as "deactivated").
export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return code === ACCOUNT_DEACTIVATED_CODE ? ACCOUNT_DEACTIVATED : "Prijava s Googleom nije uspjela. Pokušaj ponovno.";
}
