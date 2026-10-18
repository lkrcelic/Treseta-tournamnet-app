"use client";

import {approveNightAPI, discardDraftAPI, getDraftNightAPI, publishNightAPI, setRoundApprovalAPI} from "@/app/_fetchers/round/publication";
import {DraftNight, DraftRound} from "@/app/_interfaces/round";
import {RoundStatus} from "@/app/_lib/roundStatus";
import {useEffect, useRef, useState} from "react";

// Skica of one night (Upravljanje ligom · Skica on the desktop, Skica kola on the phone): its rounds, the one shown,
// and approving, publishing and discarding them. onChanged: a round's status changed (the counts elsewhere reload);
// onDiscarded: the draft is gone.
export default function useNightDraft(leagueId: number, date: string, {onChanged, onDiscarded}: {onChanged?: () => void; onDiscarded?: () => void} = {}) {
  const [night, setNight] = useState<DraftNight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // the round shown (the night's index)
  const [cur, setCur] = useState<number | null>(null);
  const [busy, setBusy] = useState<"publish" | "discard" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getDraftNightAPI(leagueId, date)
      .then((n) => {
        if (!cancelled) setNight(n);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Kola se nisu učitala.");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, date, nonce]);
  const reload = () => setNonce((n) => n + 1);

  // it opens on the first round still waiting (on the first one when every round is out)
  useEffect(() => {
    if (night && cur == null) setCur(Math.max(0, night.rounds.findIndex((r) => r.status !== "PUBLISHED")));
  }, [night, cur]);
  // the round shown stays shown when the night comes in again, though publishing numbers it and moves it before the
  // drafts left (found by one of its tables)
  const shownTables = useRef<number[]>([]);
  const lastNight = useRef<DraftNight | null>(null);
  useEffect(() => {
    if (!night || cur == null) return;
    if (night !== lastNight.current) {
      lastNight.current = night;
      const at = night.rounds.findIndex((r) => r.tables.some((t) => shownTables.current.includes(t.id)));
      if (at >= 0 && at !== cur) {
        setCur(at);
        return;
      }
    }
    shownTables.current = night.rounds[Math.min(cur, night.rounds.length - 1)]?.tables.map((t) => t.id) ?? [];
  }, [night, cur]);

  const setStatuses = (change: (r: DraftRound) => RoundStatus) =>
    setNight((n) => (n ? {...n, rounds: n.rounds.map((r) => ({...r, status: change(r)}))} : n));

  // optimistic: the round shows approved (or a draft again) at once, and goes back if the server refuses
  const toggleApproval = async (round: DraftRound) => {
    if (round.status === "PUBLISHED") return;
    const approve = round.status === "DRAFT";
    setActionError(null);
    setStatuses((r) => (r.roundNumber === round.roundNumber ? (approve ? "APPROVED" : "DRAFT") : r.status));
    try {
      await setRoundApprovalAPI(round.id, approve);
      onChanged?.();
    } catch (e) {
      setStatuses((r) => (r.roundNumber === round.roundNumber ? round.status : r.status));
      setActionError(e instanceof Error ? e.message : "Kolo nije odobreno.");
    }
  };

  const approveAll = async () => {
    setActionError(null);
    setStatuses((r) => (r.status === "DRAFT" ? "APPROVED" : r.status));
    try {
      await approveNightAPI(leagueId, date);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Kola nisu odobrena.");
      reload();
    }
    onChanged?.();
  };

  const publish = async () => {
    setBusy("publish");
    setActionError(null);
    try {
      await publishNightAPI(leagueId, date);
      reload();
      onChanged?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Kola nisu objavljena.");
      reload();
    }
    setBusy(null);
  };

  // true when the draft is gone
  const discard = async (): Promise<boolean> => {
    setBusy("discard");
    setActionError(null);
    try {
      await discardDraftAPI(leagueId, date);
      setBusy(null);
      onDiscarded?.();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Skica nije odbačena.");
      setBusy(null);
      reload();
      return false;
    }
  };

  return {night, error, reload, cur, setCur, busy, actionError, toggleApproval, approveAll, publish, discard};
}
