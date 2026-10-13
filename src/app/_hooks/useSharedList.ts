"use client";

import useAuthStore from "@/app/_store/authStore";
import {useCallback, useEffect, useSyncExternalStore} from "react";

// A list several parts of a page share (the admin's directory and the Team page's add fields): loaded per viewer,
// shown from the cache at once and refreshed when a part using it mounts (parts mounting together share one request);
// a change made on the page shows everywhere at once.
export type SharedList<T> = {
  list: T[] | null;
  error: string | null;
  reload: () => void;
};

export type SharedListStore<T> = {
  useList: () => SharedList<T>;
  // changes the list after an action on the page (a rename, a player added); a load still on its way is dropped
  update: (change: (list: T[]) => T[]) => void;
  // forgets the list and loads it again for the parts on screen
  invalidate: () => void;
  // the list as it is now (null before it loaded), for an action that needs it once (where to go after a delete)
  peek: () => T[] | null;
};

type State<T> = {userId: number | null; list: T[] | null; error: string | null};

export function sharedList<T>(load: () => Promise<T[]>, fallbackError: string): SharedListStore<T> {
  let state: State<T> = {userId: null, list: null, error: null};
  // moves on with every load, change and invalidation: an answer older than any of them is dropped
  let generation = 0;
  // the load on its way (for that viewer and generation): a part mounting meanwhile waits for it instead of asking again
  let inflight: {userId: number; generation: number} | null = null;
  const listeners = new Set<() => void>();
  const set = (next: State<T>) => {
    state = next;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  const read = () => state;

  function reload(userId: number) {
    if (inflight && inflight.userId === userId && inflight.generation === generation) return;
    const started = ++generation;
    inflight = {userId, generation: started};
    if (state.userId !== userId) set({userId, list: null, error: null});
    else if (state.error) set({...state, error: null});
    load()
      .then((list) => {
        if (started === generation) set({userId, list, error: null});
      })
      .catch((e) => {
        if (started === generation) set({...state, error: e instanceof Error ? e.message : fallbackError});
      })
      .finally(() => {
        if (inflight?.generation === started) inflight = null;
      });
  }

  function useList(): SharedList<T> {
    const userId = useAuthStore((s) => s.user?.id ?? null);
    const current = useSyncExternalStore(subscribe, read, read);
    const again = useCallback(() => {
      if (userId != null) reload(userId);
    }, [userId]);
    useEffect(() => {
      again();
    }, [again]);
    const mine = current.userId === userId;
    return {list: mine ? current.list : null, error: mine ? current.error : null, reload: again};
  }

  return {
    useList,
    update(change) {
      if (!state.list) return;
      generation++;
      set({...state, list: change(state.list)});
    },
    peek() {
      return state.list;
    },
    invalidate() {
      generation++;
      const userId = state.userId;
      set({...state, list: null, error: null});
      if (userId != null && listeners.size > 0) reload(userId);
    },
  };
}
