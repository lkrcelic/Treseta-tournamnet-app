"use client";

import {setUnauthorizedHandler} from "@/app/_fetchers/errorMessage";
import {useEffect} from "react";
import {checkSession} from "./sessionCheck";

// Keeps the stored user in sync with the session cookie. The stored user is used right away, then checked against
// the server, so logging in as someone else (or a session expiring) doesn't leave the previous player's data behind.
// The check also renews the login, so it runs again when a phone brings a long-open tab back, and whenever a request
// answers 401 (an admin deactivated the account, or the login ended on another device).
const RECHECK_AFTER_MS = 15 * 60 * 1000;

export default function UserBootstrapper() {
  useEffect(() => {
    let lastCheck = 0;
    // The middleware can only check that a session cookie is there and signed. When the login has ended,
    // /api/auth/me removes the dead cookie and checkSession sends the player to Prijava (public pages stay).
    const run = () => {
      lastCheck = Date.now();
      checkSession();
    };
    run();
    setUnauthorizedHandler(run);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > RECHECK_AFTER_MS) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      setUnauthorizedHandler(null);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
