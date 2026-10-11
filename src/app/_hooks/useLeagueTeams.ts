"use client";

import {getLeagueTeamsAPI} from "@/app/_fetchers/league/leagues";
import {useCallback, useEffect, useState} from "react";

export type LeagueTeam = {id: number; name: string; players: string[]; active: boolean};

// Teams of a league with their players' usernames and the active flag (admin only)
export default function useLeagueTeams(leagueId: number | null) {
  const [teams, setTeams] = useState<LeagueTeam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (leagueId == null) return;
    let cancelled = false;
    setError(null);
    getLeagueTeamsAPI(leagueId)
      .then((rows) => {
        if (cancelled) return;
        setTeams(rows.map((t) => ({id: t.team_id, name: t.team_name, players: t.players.map((p) => p.username), active: t.active})));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ekipe nije moguće učitati.");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, nonce]);

  // a new league starts from a loading state; a reload keeps the list on screen
  useEffect(() => setTeams(null), [leagueId]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return {teams, setTeams, error, loading: leagueId != null && teams == null && !error, reload};
}
