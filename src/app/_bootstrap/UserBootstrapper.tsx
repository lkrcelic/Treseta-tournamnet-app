"use client";

import {useEffect} from "react";
import useAuthStore from "@/app/_store/authStore";

export default function UserBootstrapper() {
  const {setUser} = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // 1) If store already has a user, do nothing
      const currentUser = useAuthStore.getState().user;
      if (currentUser !== null && currentUser !== undefined) return;

      // 2) Fallback: fetch current user once
      try {
        const res = await fetch("/api/auth/me", {credentials: "include"});
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const json = await res.json();
        if (!cancelled) setUser(json.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return null;
}