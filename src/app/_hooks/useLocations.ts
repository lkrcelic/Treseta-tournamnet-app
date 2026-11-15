"use client";

import {getLocationsAPI} from "@/app/_fetchers/locations";
import {LocationView} from "@/app/_interfaces/location";
import {NightLocation} from "@/app/_lib/nights";
import {useCallback, useEffect, useState} from "react";

// The list of places (Lokacije), shared by the Lokacije page and every place picker on the page: loaded once, and
// a place added or changed in one shows in all of them.

let cache: LocationView[] | null = null;
let loading: Promise<LocationView[]> | null = null;
const listeners = new Set<(list: LocationView[] | null) => void>();

function publish(list: LocationView[] | null) {
  cache = list;
  listeners.forEach((notify) => notify(list));
}

// A place added or changed here: every picker and the Lokacije page show it at once
export function putLocation(place: LocationView) {
  const list = cache ?? [];
  const next = list.some((l) => l.location_id === place.location_id) ? list.map((l) => (l.location_id === place.location_id ? place : l)) : [...list, place];
  publish(next.sort((a, b) => a.name.localeCompare(b.name, "hr")));
}

// A place of the loaded list as the screens use it (null: none, or not loaded): a new night's place in Datumi
export function cachedLocation(id: number | null | undefined): NightLocation | null {
  const l = id == null ? undefined : cache?.find((x) => x.location_id === id);
  return l ? {id: l.location_id, name: l.name, address: l.address, url: l.url} : null;
}

export function dropLocation(id: number) {
  publish((cache ?? []).filter((l) => l.location_id !== id));
}

export function useLocations(): {list: LocationView[] | null; error: string | null; reload: () => void} {
  const [list, setList] = useState<LocationView[] | null>(cache);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    loading = loading ?? getLocationsAPI();
    loading
      .then(publish)
      .catch((e) => setError(e instanceof Error ? e.message : "Lokacije se nisu učitale."))
      .finally(() => {
        loading = null;
      });
  }, []);
  useEffect(() => {
    listeners.add(setList);
    if (cache == null) reload();
    return () => {
      listeners.delete(setList);
    };
  }, [reload]);
  return {list, error, reload};
}
