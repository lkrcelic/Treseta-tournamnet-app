"use client";

import {isSlot, Slot} from "@/app/_lib/locations";
import {useCallback, useEffect, useState} from "react";

// The place picked on Dnevni poredak of a two-place night (Sve: null), per league and browser tab like the conference
// filter, but its own memory: the season's table (/standings) has no places. It survives a visit to a table's scorepad.
const key = (leagueId: number) => `treseta.place.${leagueId}`;
// read from sessionStorage once per league; private mode keeps the pick here until the page is reloaded
const picks = new Map<number, Slot | null>();
const listeners = new Set<() => void>();

function readPicked(leagueId: number): Slot | null {
  if (!picks.has(leagueId)) {
    let slot: Slot | null = null;
    try {
      const v = Number(window.sessionStorage.getItem(key(leagueId)));
      slot = isSlot(v) ? v : null;
    } catch {
      // private mode
    }
    picks.set(leagueId, slot);
  }
  return picks.get(leagueId) ?? null;
}

// The picked place of the league's night (null: Sve), and the setter
export default function useLocationFilter(leagueId: number): [Slot | null, (slot: Slot | null) => void] {
  const [picked, setPicked] = useState<Slot | null>(null);

  useEffect(() => {
    const sync = () => setPicked(readPicked(leagueId));
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, [leagueId]);

  const pick = useCallback(
    (slot: Slot | null) => {
      picks.set(leagueId, slot);
      try {
        if (slot == null) window.sessionStorage.removeItem(key(leagueId));
        else window.sessionStorage.setItem(key(leagueId), String(slot));
      } catch {
        // private mode: kept in `picks`
      }
      listeners.forEach((notify) => notify());
    },
    [leagueId]
  );

  return [picked, pick];
}
