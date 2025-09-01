"use client";

import {useEffect} from "react";
import useAuthStore from "@/app/_store/authStore";

export default function UserBootstrapper() {
  const {setUser} = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
