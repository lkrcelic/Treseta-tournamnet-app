"use client";

import {getLeagueNightsAPI} from "@/app/_fetchers/league/nights";
import {LeagueNightRow} from "@/app/_interfaces/league";
import React, {useCallback, useEffect, useState} from "react";

// A league's nights (Upravljanje ligom · Datumi, Raspored of a league the player isn't in)
export default function useLeagueNights(leagueId: number | null | undefined): {
  nights: LeagueNightRow[] | null;
  setNights: React.Dispatch<React.SetStateAction<LeagueNightRow[] | null>>;
  error: string | null;
  reload: () => void;
} {
  const [nights, setNights] = useState<LeagueNightRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (leagueId == null) return;
    setError(null);
    getLeagueNightsAPI(leagueId)
      .then(setNights)
      .catch((e) => setError(e instanceof Error ? e.message : "Večeri lige se nisu učitale."));
  }, [leagueId]);

  useEffect(() => {
    setNights(null);
    reload();
  }, [reload]);

  return {nights, setNights, error, reload};
}
