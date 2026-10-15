"use client";

import {getLeagueRoundsAPI, LeagueRoundSummary} from "@/app/_fetchers/admin/daily";
import {useEffect, useState} from "react";

// Every round of a league with its status, drafts too (admin: Upravljanje ligom · Kola and Skica, Večer lige). Waits
// while the league id is still loading (undefined) or missing (null).
export default function useLeagueRounds(leagueId: number | null | undefined) {
  const [rounds, setRounds] = useState<LeagueRoundSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (leagueId == null) return;
    let cancelled = false;
    setError(null);
    getLeagueRoundsAPI(leagueId)
      .then((r) => {
        if (!cancelled) setRounds(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Kola se nisu učitala.");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, nonce]);
  return {rounds, setRounds, error, reload: () => setNonce((n) => n + 1)};
}
