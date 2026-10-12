"use client";

import {getMyBurzaAPI} from "@/app/_fetchers/burza";
import {MyBurzaList} from "@/app/_interfaces/burza";
import useAuthStore from "@/app/_store/authStore";
import {useCallback, useEffect, useState} from "react";

// Moji oglasi: the player's own ads, shown from the session cache at once and refreshed on every mount. The cache is
// per player; publishing or closing an ad elsewhere forgets it (invalidateMyBurza).
let cache: {userId: number; list: MyBurzaList} | null = null;
// Moves on with every load, change on the page and invalidation: a load that answers after any of them is older than
// what is shown (a refresh still on its way when an ad was closed would bring the ad back) and is dropped
let generation = 0;

export function invalidateMyBurza() {
  cache = null;
  generation++;
}

export default function useMyBurza(): {
  list: MyBurzaList | null;
  error: string | null;
  reload: () => void;
  // changes the list after an action on the page (closed, published again), in the cache too
  update: (change: (list: MyBurzaList) => MyBurzaList) => void;
} {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [list, setList] = useState<MyBurzaList | null>(cache && cache.userId === userId ? cache.list : null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (userId == null) return;
    const started = ++generation;
    setError(null);
    getMyBurzaAPI()
      .then((l) => {
        if (started !== generation) return;
        cache = {userId, list: l};
        setList(l);
      })
      .catch((e) => {
        if (started === generation) setError(e instanceof Error ? e.message : "Oglasi se nisu učitali.");
      });
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // only called from an ad on the page, so there is a list (a first load it would drop can't be in flight)
  const update = useCallback(
    (change: (list: MyBurzaList) => MyBurzaList) => {
      generation++;
      setList((l) => {
        if (!l) return l;
        const next = change(l);
        if (userId != null) cache = {userId, list: next};
        return next;
      });
    },
    [userId]
  );

  return {list, error, reload, update};
}
