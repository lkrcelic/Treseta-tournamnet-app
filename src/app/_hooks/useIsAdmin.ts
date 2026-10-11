"use client";

import {useEffect, useState} from "react";

// Whether the logged-in player is an admin. Starts false so admin-only UI never flashes for players.
export default function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/session/is-admin")
      .then((res) => (res.ok ? res.json() : false))
      .then((data) => {
        if (!cancelled) setIsAdmin(data === true);
      })
      .catch(() => {
        // treated as not an admin
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
