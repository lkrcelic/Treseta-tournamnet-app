"use client";

import {getMyScheduleAPI} from "@/app/_fetchers/burza";
import {MySchedule} from "@/app/_interfaces/burza";
import useAuthStore from "@/app/_store/authStore";
import {useCallback, useEffect, useState} from "react";

// The leagues the logged-in player plays in, with their team and nights (Početna, Raspored, Trebam zamjenu).
// Cached for the session per player and refreshed on every mount.
let cache: {userId: number; schedule: MySchedule} | null = null;

export default function useMySchedule(): {schedule: MySchedule | null; error: string | null; reload: () => void} {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [schedule, setSchedule] = useState<MySchedule | null>(cache && cache.userId === userId ? cache.schedule : null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (userId == null) return;
    setError(null);
    getMyScheduleAPI()
      .then((s) => {
        cache = {userId, schedule: s};
        setSchedule(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Raspored se nije učitao."));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {schedule, error, reload};
}
