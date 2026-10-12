import "./helpers/memoryStorage";
import assert from "node:assert/strict";
import {test} from "node:test";
import {loginRedirect} from "@/app/_bootstrap/sessionCheck";
import {ACCOUNT_DEACTIVATED, ACCOUNT_DEACTIVATED_CODE, loginErrorMessage} from "@/app/_interfaces/login";
import {isPublicPagePath} from "@/app/_lib/publicPaths";

// A login that ends while the app is open (expired, or an admin deactivated the account) goes to Prijava, which says
// why; a failed Google login comes back there too.

test("an ended login goes to Prijava, a deactivated one with its message", () => {
  assert.equal(loginRedirect(401), "/login");
  assert.equal(loginRedirect(403), `/login?error=${ACCOUNT_DEACTIVATED_CODE}`);
  assert.equal(loginErrorMessage(ACCOUNT_DEACTIVATED_CODE), ACCOUNT_DEACTIVATED);
  // still logged in, offline, or a server error: stay
  for (const status of [200, 500, 503, null]) assert.equal(loginRedirect(status), null, String(status));
});

test("only the app's own code means a deactivated account", () => {
  // NextAuth's AccessDenied is also any error inside the signIn callback (a database hiccup)
  for (const code of ["AccessDenied", "OAuthCallbackError", "Configuration", "Verification"]) {
    assert.equal(loginErrorMessage(code), "Prijava s Googleom nije uspjela. Pokušaj ponovno.", code);
  }
  assert.equal(loginErrorMessage(null), null);
  assert.equal(loginErrorMessage(""), null);
});

test("public pages aren't sent to Prijava", () => {
  for (const path of ["/login", "/signup", "/league/2/standings", "/league/current/standings", "/burza", "/burza/12"]) {
    assert.equal(isPublicPagePath(path), true, path);
  }
  for (const path of ["/", "/ratings", "/profile", "/burza/moji", "/burza/novi/zamjena", "/league/2/daily-standings"]) {
    assert.equal(isPublicPagePath(path), false, path);
  }
});
