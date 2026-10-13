"use client";

import useAuthStore from "@/app/_store/authStore";
import {useCallback, useEffect, useRef, useState} from "react";

// What useTeamOverview and usePlayerOverview return
export type Overview<T> = {
  // the page of this id: never another id's while the new one loads
  data: T | null;
  // changes the page after an action on it (admin), in the cache too; a load still on its way is then dropped. Only a
  // page that is shown can change (nothing happens before the first answer); to leave a page that is gone (a deleted
  // player), navigate away or call reload, which answers missing.
  setData: (change: T | ((prev: T) => T)) => void;
  error: string | null;
  // the server answered 404 (no such team or player, or a deleted player)
  missing: boolean;
  // nothing to show yet: no data, no error, not missing
  loading: boolean;
  reload: () => void;
};

// Pages by viewer and id, so going Back to a page shows it at once (it is refreshed on every mount). Personal data
// differs per viewer, hence the viewer in the key; logging out reloads the app, which empties it.
export type OverviewCache<T> = Map<string, T>;

type State<T> = {key: string; data: T | null; error: string | null; missing: boolean};

// Loads one page (a team's or a player's) by id: shown from the cache at once and refreshed on every mount
export function useOverview<T>(
  id: number,
  load: (id: number) => Promise<T | null>,
  cache: OverviewCache<T>,
  fallbackError: string
): Overview<T> {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const key = `${viewerId ?? ""}:${id}`;
  const fresh = useCallback((k: string): State<T> => ({key: k, data: cache.get(k) ?? null, error: null, missing: false}), [cache]);
  const [state, setState] = useState<State<T>>(() => fresh(key));
  // moves on with every load and every setData: an answer from before either is dropped
  const generation = useRef(0);

  const reload = useCallback(() => {
    // the pages need a login, so a user is on the way (UserBootstrapper); loading without one would only be redone
    if (viewerId == null) return;
    const started = ++generation.current;
    setState((s) => (s.key === key ? {...s, error: null} : fresh(key)));
    load(id)
      .then((found) => {
        if (started !== generation.current) return;
        if (found == null) cache.delete(key);
        else cache.set(key, found);
        setState({key, data: found, error: null, missing: found == null});
      })
      .catch((e) => {
        if (started !== generation.current) return;
        setState((s) => ({...(s.key === key ? s : fresh(key)), error: e instanceof Error ? e.message : fallbackError}));
      });
  }, [id, key, viewerId, load, cache, fresh, fallbackError]);

  useEffect(() => {
    reload();
  }, [reload]);

  // the page as last shown: setData changes only a page that is there
  const shown = useRef(state);
  useEffect(() => {
    shown.current = state;
  }, [state]);

  const setData = useCallback(
    (change: T | ((prev: T) => T)) => {
      if (shown.current.key !== key || shown.current.data == null) return;
      // whichever comes first, the change stays: a load that answers after it is dropped, one that answered before
      // it is what the change applies to. Counted here, not in the state update (which React runs later), so a reload
      // asked for right after the change is not dropped with the loads before it.
      generation.current++;
      setState((s) => {
        if (s.key !== key || s.data == null) return s;
        const data = typeof change === "function" ? (change as (prev: T) => T)(s.data) : change;
        cache.set(key, data);
        return {...s, data};
      });
    },
    [key, cache]
  );

  // the first render after the id changed still holds the previous page's state
  const current = state.key === key ? state : fresh(key);
  return {
    data: current.data,
    setData,
    error: current.error,
    missing: current.missing,
    loading: current.data == null && current.error == null && !current.missing,
    reload,
  };
}
