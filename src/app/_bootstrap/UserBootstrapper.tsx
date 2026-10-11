"use client";

import {useEffect} from "react";
import {refreshUser} from "./refreshUser";

// Keeps the stored user in sync with the session cookie. The stored user is used right away, then checked against
// the server, so logging in as someone else (or a session expiring) doesn't leave the previous player's data behind.
// The check also renews the login, so it runs again when a phone brings a long-open tab back.
const RECHECK_AFTER_MS = 15 * 60 * 1000;

// pages that work without logging in
function isPublicPath(path: string): boolean {
  return path.startsWith("/login") || path.startsWith("/signup") || /^\/league\/\d+\/standings\/?$/.test(path);
}

export default function UserBootstrapper() {
  useEffect(() => {
    let cancelled = false;
    let lastCheck = 0;
    const run = async () => {
      lastCheck = Date.now();
      const status = await refreshUser();
      // The middleware can only check that a session cookie is there and signed. /api/auth/me has removed the dead
      // cookie by now; send the player to the login page (the season table stays public).
      if (!cancelled && status === 401 && !isPublicPath(window.location.pathname)) {
        window.location.replace("/login");
      }
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > RECHECK_AFTER_MS) run();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
