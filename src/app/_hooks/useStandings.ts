"use client";

import {getRoundDatesByLeagueIdAPI} from "@/app/_fetchers/league/getRoundDates";
import {getLeagueStandingsAPI} from "@/app/_fetchers/league/getStandings";
import {getLeagueStandingsByDateAPI} from "@/app/_fetchers/league/getStandingsByDate";
import {getRoundsAPI} from "@/app/_fetchers/round/getRounds";
import {RoundExtendedResponse} from "@/app/_interfaces/round";
import {isByeTeam} from "@/app/_lib/bye";
import {StandingsItem} from "@/app/_lib/ui/standings";
import {useCallback, useEffect, useRef, useState} from "react";

const withoutBye = (items: unknown): StandingsItem[] =>
  (Array.isArray(items) ? (items as StandingsItem[]) : []).filter((s) => s.team_id == null || !isByeTeam(Number(s.team_id)));

// A league id that may still be loading (undefined) or missing (null); the hooks below wait until it is known
type MaybeLeague = number | null | undefined;

// Dates (YYYY-MM-DD, ascending) on which the league played
export function useRoundDates(leagueId: MaybeLeague) {
  const [dates, setDates] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDates(null);
    setError(null);
    if (leagueId == null) return;
    getRoundDatesByLeagueIdAPI(leagueId)
      .then((d) => {
        if (!cancelled) setDates(Array.isArray(d) ? [...d].sort() : []);
      })
      .catch(() => {
        if (!cancelled) {
          setDates([]);
          setError("Datume nije moguće učitati.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, nonce]);

  return {dates, error, reload: () => setNonce((n) => n + 1)};
}

export type DailyData = {
  standings: StandingsItem[];
  rounds: RoundExtendedResponse[];
  // round numbers played that night, ascending
  roundNumbers: number[];
};

// Standings and tables of one night. Refreshes every 30 s without showing the loading state again.
export function useDailyData(leagueId: MaybeLeague, date: string | null) {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const hasData = useRef(false);

  const load = useCallback(
    async (quiet: boolean) => {
      if (!date || leagueId == null) return;
      const id = ++reqId.current;
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      try {
        const [standings, rounds] = await Promise.all([
          getLeagueStandingsByDateAPI(leagueId, date),
          getRoundsAPI({round_date: date, league_id: leagueId}),
        ]);
        if (id !== reqId.current) return;
        const roundNumbers = Array.from(new Set(rounds.map((r) => r.round_number).filter((n) => n != null))).sort((a, b) => a - b);
        setData({standings: withoutBye(standings), rounds, roundNumbers});
        hasData.current = true;
        setError(null);
      } catch {
        if (id !== reqId.current) return;
        // a failed background refresh keeps the last data on screen (if there is any)
        if (!quiet || !hasData.current) setError("Poredak nije moguće učitati.");
      } finally {
        // the latest request ends the loading state, also when it was a background refresh that overtook a load
        if (id === reqId.current) setLoading(false);
      }
    },
    [leagueId, date]
  );

  useEffect(() => {
    if (!date) return;
    setData(null);
    hasData.current = false;
    load(false);
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [date, load]);

  // refresh: reload without the loading state (after an admin edit)
  return {data, loading: loading || !date, error, reload: () => load(false), refresh: () => load(true)};
}

// Season table of a league
export function useLeagueStandings(leagueId: MaybeLeague) {
  const [standings, setStandings] = useState<StandingsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStandings(null);
    setError(null);
    if (leagueId == null) return;
    getLeagueStandingsAPI(leagueId)
      .then((s) => {
        if (!cancelled) setStandings(withoutBye(s));
      })
      .catch(() => {
        if (!cancelled) setError("Poredak nije moguće učitati.");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, nonce]);

  return {standings, loading: standings == null && !error, error, reload: () => setNonce((n) => n + 1)};
}
