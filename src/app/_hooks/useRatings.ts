"use client";

import {getRatingsAPI} from "@/app/_fetchers/ratings";
import {RatingRow, RatingsList} from "@/app/_interfaces/ratings";
import {useCallback, useEffect, useState} from "react";

// The ratings list, shared by Home, Profile and the ratings page: shown from the session cache at once and
// refreshed on every mount, so a night's new ratings appear without a reload
let cache: RatingsList | null = null;
let inflight: Promise<RatingsList> | null = null;

function loadRatings(): Promise<RatingsList> {
  inflight ??= getRatingsAPI()
    .then((data) => (cache = data))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export default function useRatings(): {list: RatingsList | null; error: string | null; reload: () => void} {
  const [list, setList] = useState<RatingsList | null>(cache);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    loadRatings()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Rejting se nije učitao."));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {list, error, reload};
}

// The viewer's own row, for the Home tile and the Profile card (null while loading or when they aren't listed)
export function useMyRating(): {me: RatingRow | null; total: number} {
  const {list} = useRatings();
  const me = list?.players.find((p) => p.id === list.me) ?? null;
  return {me, total: list?.players.length ?? 0};
}
