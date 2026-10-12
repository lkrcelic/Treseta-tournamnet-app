import {ACCOUNT_DEACTIVATED_CODE} from "@/app/_interfaces/login";
import {isPublicPagePath} from "@/app/_lib/publicPaths";
import {refreshUser} from "./refreshUser";

// Where a login that ended goes: /api/auth/me answers 401 when nobody is logged in any more (expired, logged out on
// another device) and 403 when an admin deactivated the account, which Prijava explains. null = the login is fine, or
// the server couldn't say (offline, a server error): stay.
export function loginRedirect(status: number | null): string | null {
  if (status === 401) return "/login";
  if (status === 403) return `/login?error=${ACCOUNT_DEACTIVATED_CODE}`;
  return null;
}

let pending: Promise<void> | null = null;
// set once the page is on its way to Prijava: requests still answering 401 must not start another check, whose
// plain 401 (the cookies are gone by then) would replace /login?error=… and lose the "deaktiviran" message
let leaving = false;

// Asks the server who is logged in (refreshUser, which also drops the stored user) and, when the login has ended,
// sends the player to Prijava. Runs on every app load (UserBootstrapper) and after any request answers 401
// (apiFetch), so a deactivated player is shut out on the next thing they do, not on the next reload. Requests that
// fail together share one check. Pages that work without a login stay where they are.
export function checkSession(): Promise<void> {
  if (leaving) return Promise.resolve();
  if (!pending) {
    pending = (async () => {
      const to = loginRedirect(await refreshUser());
      if (to && !isPublicPagePath(window.location.pathname)) {
        leaving = true;
        window.location.replace(to);
      }
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}
