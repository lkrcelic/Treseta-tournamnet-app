"use client";

import {
  getAdminTournamentAPI,
  getAdminTournamentsAPI,
  getTournamentAPI,
  getTournamentResultsAPI,
  getTournamentsAPI,
  TournamentError,
} from "@/app/_fetchers/tournament";
import {AdminTournament, TournamentCard, TournamentDetail, TournamentResults} from "@/app/_interfaces/tournament";
import useAuthStore from "@/app/_store/authStore";
import {useCallback, useEffect, useRef, useState} from "react";

// Reads of the tournament API with the app's usual shape: the data, an error, reload() (shows the spinner again) and
// refresh() (quietly, for polling). every: poll every N ms while the page is visible.
function useRead<T>(load: (() => Promise<T>) | null, key: string, every?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nonce, setNonce] = useState(0);
  const quiet = useRef(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const run = loadRef.current;
    if (!run) return;
    let cancelled = false;
    if (!quiet.current) setError(null);
    run()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        setNotFound(false);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof TournamentError && e.status === 404) setNotFound(true);
        // a quiet refresh keeps what is shown
        if (!quiet.current) setError(e instanceof Error ? e.message : "Nije se učitalo.");
      })
      .finally(() => {
        quiet.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  useEffect(() => {
    if (!every || !load) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      quiet.current = true;
      setNonce((n) => n + 1);
    }, every);
    return () => window.clearInterval(id);
  }, [every, key, load]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => {
    quiet.current = true;
    setNonce((n) => n + 1);
  }, []);
  return {data, setData, error, notFound, reload, refresh};
}

// Every tournament (Početna · Turniri, Nadolazeći, Završeni turniri); also for a visitor
export function useTournaments(every?: number) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const r = useRead<TournamentCard[]>(getTournamentsAPI, `list|${userId}`, every);
  return {tournaments: r.data, error: r.error, reload: r.reload, refresh: r.refresh};
}

// A tournament's page; polls while it is being played
export function useTournament(id: number | null, every?: number) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const r = useRead<TournamentDetail>(id == null ? null : () => getTournamentAPI(id), `t|${id}|${userId}`, every);
  return {tournament: r.data, setTournament: r.setData, error: r.error, notFound: r.notFound, reload: r.reload, refresh: r.refresh};
}

// Poredak i rezultati: the standings and the published Kolos
export function useTournamentResults(id: number | null, every?: number) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const r = useRead<TournamentResults>(id == null ? null : () => getTournamentResultsAPI(id), `r|${id}|${userId}`, every);
  return {results: r.data, error: r.error, notFound: r.notFound, reload: r.reload, refresh: r.refresh};
}

// The admin's Turniri list
export function useAdminTournaments() {
  const r = useRead<TournamentCard[]>(getAdminTournamentsAPI, "admin-list");
  return {tournaments: r.data, setTournaments: r.setData, error: r.error, reload: r.reload};
}

// Upravljanje turnirom: one tournament, refreshed every 15 s while a Kolo is being played
export function useAdminTournament(id: number | null, every?: number) {
  const r = useRead<AdminTournament>(id == null ? null : () => getAdminTournamentAPI(id), `admin|${id}`, every);
  return {tournament: r.data, setTournament: r.setData, error: r.error, notFound: r.notFound, reload: r.reload, refresh: r.refresh};
}
