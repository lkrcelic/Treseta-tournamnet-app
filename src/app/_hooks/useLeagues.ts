"use client";

import {getLeaguesAPI} from "@/app/_fetchers/league/leagues";
import {LeagueSummary} from "@/app/_interfaces/league";
import {BRAND} from "@/app/_lib/brand";
import {plural} from "@/app/_lib/ui/text";
import {useEffect, useState} from "react";

export type LeagueOption = {
  id: number;
  name: string;
  meta?: string;
  roundsPerNight: number;
  // the smoking tables of its last Create Round (empty: none)
  smokingTables?: number[];
  active: boolean;
  season?: string | null;
  startDate?: string | null; // YYYY-MM-DD
  endDate?: string | null;
  playDay?: number | null; // 0 = Monday ... 6 = Sunday
  teamCount?: number;
};

// "na koji dan" for the league meta line: "16 ekipa · utorkom"
const PLAY_DAY = ["ponedjeljkom", "utorkom", "srijedom", "četvrtkom", "petkom", "subotom", "nedjeljom"];

// cached for the session; every page with a league picker asks for the same list, and screens mounting together
// share one request
let cache: LeagueOption[] | null = null;
let inflight: Promise<LeagueOption[]> | null = null;
// mounted pickers, told when a league is renamed
const listeners = new Set<(leagues: LeagueOption[]) => void>();

function leagueMeta(teamCount: number, playDay: number | null | undefined, active: boolean): string {
  return [`${teamCount} ${plural(teamCount, "ekipa", "ekipe", "ekipa")}`, playDay != null ? PLAY_DAY[playDay] : null, active ? "aktivna" : null]
    .filter(Boolean)
    .join(" · ");
}

function toOption(l: LeagueSummary): LeagueOption {
  return {
    id: l.league_id,
    name: l.league_name,
    roundsPerNight: l.rounds_per_night,
    smokingTables: l.smoking_tables ?? [],
    active: l.active,
    season: l.season,
    startDate: l.start_date,
    endDate: l.end_date,
    playDay: l.play_day,
    teamCount: l.team_count,
    meta: leagueMeta(l.team_count, l.play_day, l.active),
  };
}

function loadLeagues(): Promise<LeagueOption[]> {
  inflight ??= getLeaguesAPI()
    .then((data) => {
      cache = data.map(toOption);
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function useLeagueList(): {leagues: LeagueOption[] | null; error: boolean} {
  const [leagues, setLeagues] = useState<LeagueOption[] | null>(cache);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listeners.add(setLeagues);
    loadLeagues()
      .then((options) => {
        if (!cancelled) setLeagues(options);
      })
      .catch(() => {
        // keeps whatever is shown
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      listeners.delete(setLeagues);
    };
  }, []);

  return {leagues, error};
}

// All leagues for the league pickers (the list is public, so it also works before logging in). A page showing one
// league passes its id, so its picker has something to show before the list arrives.
export default function useLeagues(currentId?: number): LeagueOption[] {
  const {leagues} = useLeagueList();
  if (leagues?.length) return leagues;
  return currentId != null ? [{id: currentId, name: BRAND.name, roundsPerNight: 3, active: false}] : [];
}

// The league being played now (the latest round night): undefined while loading, null when there is none
export function useActiveLeagueId(): number | null | undefined {
  const {leagues, error} = useLeagueList();
  if (leagues) return leagues.find((l) => l.active)?.id ?? null;
  return error ? null : undefined;
}

// The league picked in a league picker (Početna, Daily, League Standings, Manage League) for this browser tab. The
// menu links and Početna follow it; until a league is picked they show the league being played now.
const CHOSEN_KEY = "bela.chosenLeague";
let chosen: number | null | undefined; // undefined: not read from sessionStorage yet
const chosenListeners = new Set<(id: number | null) => void>();

function readChosen(): number | null {
  if (chosen === undefined) {
    try {
      const v = Number(window.sessionStorage.getItem(CHOSEN_KEY));
      chosen = Number.isInteger(v) && v > 0 ? v : null;
    } catch {
      chosen = null;
    }
  }
  return chosen;
}

export function chooseLeague(id: number) {
  chosen = id;
  try {
    window.sessionStorage.setItem(CHOSEN_KEY, String(id));
  } catch {
    // private mode: remembered until the page is reloaded
  }
  chosenListeners.forEach((notify) => notify(id));
}

// The picked league, or the one being played now: undefined while loading, null when there are no leagues
export function useSelectedLeagueId(): number | null | undefined {
  const {leagues, error} = useLeagueList();
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    setPicked(readChosen());
    chosenListeners.add(setPicked);
    return () => {
      chosenListeners.delete(setPicked);
    };
  }, []);
  if (leagues) {
    if (picked != null && leagues.some((l) => l.id === picked)) return picked;
    return leagues.find((l) => l.active)?.id ?? null;
  }
  return error ? null : undefined;
}

// Clears the cached list after a league was created
export function invalidateLeagues() {
  cache = null;
}

// Shows a league's new name and details everywhere at once, without fetching the list again
export function updateCachedLeague(id: number, change: Partial<Omit<LeagueOption, "id" | "meta">>) {
  if (!cache) return;
  cache = cache.map((l) => {
    if (l.id !== id) return l;
    const next = {...l, ...change};
    return {...next, meta: leagueMeta(next.teamCount ?? 0, next.playDay, next.active)};
  });
  listeners.forEach((notify) => notify(cache!));
}

export function renameCachedLeague(id: number, name: string) {
  updateCachedLeague(id, {name});
}
