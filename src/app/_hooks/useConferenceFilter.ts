"use client";

import {Conference} from "@/app/_lib/conferences";
import {useCallback, useEffect, useState} from "react";

// The conference picked on Daily or League standings, per league and browser tab (like the league picker), so both
// screens show the same one and it survives a visit to a table's scorepad
const key = (leagueId: number) => `treseta.conference.${leagueId}`;
// read from sessionStorage once per league; private mode keeps the pick here until the page is reloaded
const picks = new Map<number, number | null>();
const listeners = new Set<() => void>();

function readPicked(leagueId: number): number | null {
  if (!picks.has(leagueId)) {
    let id: number | null = null;
    try {
      const v = Number(window.sessionStorage.getItem(key(leagueId)));
      id = Number.isInteger(v) && v > 0 ? v : null;
    } catch {
      // private mode
    }
    picks.set(leagueId, id);
  }
  return picks.get(leagueId) ?? null;
}

// The picked conference of the league (null: the whole table), and the setter. A conference that is gone (or of
// another league) counts as none.
export default function useConferenceFilter(leagueId: number, conferences: Conference[]): [number | null, (id: number | null) => void] {
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setPicked(readPicked(leagueId));
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, [leagueId]);

  const pick = useCallback(
    (id: number | null) => {
      picks.set(leagueId, id);
      try {
        if (id == null) window.sessionStorage.removeItem(key(leagueId));
        else window.sessionStorage.setItem(key(leagueId), String(id));
      } catch {
        // private mode: kept in `picks`
      }
      listeners.forEach((notify) => notify());
    },
    [leagueId]
  );

  return [picked != null && conferences.some((c) => c.id === picked) ? picked : null, pick];
}
