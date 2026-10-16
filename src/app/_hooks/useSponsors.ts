"use client";

import {getAdminSponsorsAPI, getLeagueSponsorsAPI} from "@/app/_fetchers/sponsors";
import {SponsorAdmin, SponsorPublic} from "@/app/_interfaces/sponsor";
import React, {useCallback, useEffect, useRef, useState} from "react";

// A league's sponsors for the band (Početna, the live round): shown from the session cache at once and refreshed on
// every mount, so a change made in Upravljanje ligom shows on the next visit
const leagueCache = new Map<number, SponsorPublic[]>();
// the mounted lists, told to fetch again when the admin changes a league's sponsors (the count on the Sponzori tab)
const listeners = new Set<(leagueId: number | null) => void>();

export function useLeagueSponsors(leagueId: number | null | undefined): SponsorPublic[] | null {
  const [sponsors, setSponsors] = useState<SponsorPublic[] | null>(leagueId != null ? leagueCache.get(leagueId) ?? null : null);
  const [version, setVersion] = useState(0);
  const shownFor = useRef<number | null>(null);
  useEffect(() => {
    const changed = (id: number | null) => {
      if (id == null || id === leagueId) setVersion((v) => v + 1);
    };
    listeners.add(changed);
    return () => {
      listeners.delete(changed);
    };
  }, [leagueId]);
  useEffect(() => {
    if (leagueId == null) {
      setSponsors(null);
      return;
    }
    let cancelled = false;
    // another league: its list from the cache, or nothing until it comes (fetching again keeps the one shown)
    if (shownFor.current !== leagueId) setSponsors(leagueCache.get(leagueId) ?? null);
    shownFor.current = leagueId;
    getLeagueSponsorsAPI(leagueId)
      .then((list) => {
        leagueCache.set(leagueId, list);
        if (!cancelled) setSponsors(list);
      })
      .catch(() => {
        // no band, nothing else: the page works without its sponsors
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, version]);
  return sponsors;
}

// After the admin changed a league's sponsors (or a sponsor), so the band doesn't show the old ones from the cache
export function forgetLeagueSponsors(leagueId?: number) {
  if (leagueId == null) leagueCache.clear();
  else leagueCache.delete(leagueId);
  listeners.forEach((notify) => notify(leagueId ?? null));
}

// The admin's list of every sponsor (Sponzori, and Upravljanje ligom · Sponzori to pick from)
export function useAdminSponsors(): {
  list: SponsorAdmin[] | null;
  setList: React.Dispatch<React.SetStateAction<SponsorAdmin[] | null>>;
  error: string | null;
  reload: () => void;
} {
  const [list, setList] = useState<SponsorAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    getAdminSponsorsAPI()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Sponzori se nisu učitali."));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return {list, setList, error, reload};
}
