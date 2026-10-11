"use client";

import {deleteLeagueRoundAPI, getLeagueRoundsAPI, LeagueRoundSummary} from "@/app/_fetchers/admin/daily";
import {displayDate} from "@/app/_lib/ui/text";
import {color, font} from "@/app/_styles/tokens";
import {buttonBase, Card, EmptyState, ErrorNote, InfoNote, LoadingRows} from "@/app/_ui/sp";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import React, {useCallback, useEffect, useRef, useState} from "react";

// Manage League · Rounds: every round of the league per night, and deleting one. A delete waits a few seconds so it
// can be undone; it is sent right away when another round is deleted or the page is left.

const UNDO_MS = 8000;
const keyOf = (r: LeagueRoundSummary) => `${r.date}|${r.roundNumber}`;

const STATUS: Record<LeagueRoundSummary["status"], {label: string; ink: string}> = {
  played: {label: "Played", ink: color.green},
  live: {label: "In progress", ink: color.red},
  new: {label: "Not started", ink: color.placeholder},
};

function warning(r: LeagueRoundSummary): string {
  if (r.status === "new") return `Nothing has been played yet. The ${r.tables} pairings will be removed.`;
  if (r.status === "live") return `This round is in progress. ${r.tables} tables and their hands will be removed.`;
  return `${r.tables} tables and all recorded results will be removed. Standings and ratings are recalculated.`;
}

export function useLeagueRounds(leagueId: number) {
  const [rounds, setRounds] = useState<LeagueRoundSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    getLeagueRoundsAPI(leagueId)
      .then((r) => {
        if (!cancelled) setRounds(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Runde nije moguće učitati.");
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, nonce]);
  return {rounds, setRounds, error, reload: () => setNonce((n) => n + 1)};
}

type Pending = {round: LeagueRoundSummary; index: number; timer: number};

export default function RoundsView({leagueId, data}: {leagueId: number; data: ReturnType<typeof useLeagueRounds>}) {
  const {rounds, setRounds, error, reload} = data;
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const send = useCallback(
    async (p: Pending, keepalive = false) => {
      window.clearTimeout(p.timer);
      try {
        await deleteLeagueRoundAPI(leagueId, p.round.date, p.round.roundNumber, keepalive);
      } catch (e) {
        // put it back where it was
        setRounds((prev) => {
          if (!prev || prev.some((r) => keyOf(r) === keyOf(p.round))) return prev;
          const next = [...prev];
          next.splice(Math.min(p.index, next.length), 0, p.round);
          return next;
        });
        setActionError(e instanceof Error ? e.message : "Runda nije obrisana.");
      }
    },
    [leagueId, setRounds]
  );

  // leaving the page (or closing it) sends a delete that is still waiting
  useEffect(() => {
    const flush = () => {
      if (pendingRef.current) send(pendingRef.current, true);
      pendingRef.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [send]);

  const remove = (r: LeagueRoundSummary) => {
    if (!rounds) return;
    setActionError(null);
    if (pending) send(pending);
    const index = rounds.findIndex((x) => keyOf(x) === keyOf(r));
    setRounds(rounds.filter((x) => keyOf(x) !== keyOf(r)));
    setConfirm(null);
    const p: Pending = {round: r, index, timer: 0};
    p.timer = window.setTimeout(() => {
      setPending((cur) => (cur === p ? null : cur));
      send(p);
    }, UNDO_MS);
    setPending(p);
  };

  const undo = () => {
    if (!pending) return;
    window.clearTimeout(pending.timer);
    setRounds((prev) => {
      const next = [...(prev ?? [])];
      next.splice(Math.min(pending.index, next.length), 0, pending.round);
      return next;
    });
    setPending(null);
  };

  const grid = "110px 130px 90px 140px minmax(0,1fr)";
  const small = {...buttonBase, height: 44, px: "16px", borderRadius: "12px", fontSize: 14, fontWeight: 600, flex: "none"} as const;

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: "20px"}}>
      <Card component="section" aria-label="Runde lige" sx={{minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px"}}>
        <Box
          aria-hidden
          sx={{flex: "none", height: 40, display: "grid", gridTemplateColumns: grid, gap: "12px", alignItems: "center", px: "20px", background: color.tableHead, borderBottom: `1px solid rgba(60,74,103,.1)`, fontSize: 12, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: color.muted}}
        >
          <span>Round</span>
          <span>Date</span>
          <Box component="span" sx={{textAlign: "center"}}>
            Tables
          </Box>
          <span>Status</span>
          <span />
        </Box>
        {actionError && <ErrorNote sx={{m: "12px 14px 0"}}>{actionError}</ErrorNote>}
        {error ? (
          <ErrorNote onRetry={reload} sx={{m: "14px"}}>
            {error}
          </ErrorNote>
        ) : rounds == null ? (
          <LoadingRows rows={8} height={60} />
        ) : rounds.length === 0 ? (
          <EmptyState>This league has no rounds.</EmptyState>
        ) : (
          <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, flex: 1, minHeight: 0, overflowY: "auto", scrollbarGutter: "stable"}}>
            {rounds.map((r) => {
              const k = keyOf(r);
              const asking = confirm === k;
              const st = STATUS[r.status];
              return (
                <Box component="li" key={k} sx={{display: "flex", flexDirection: "column", borderBottom: `1px solid rgba(60,74,103,.07)`, background: asking ? "rgba(188,71,73,.06)" : "transparent", transition: "background 160ms ease"}}>
                  <Box sx={{height: 60, display: "grid", gridTemplateColumns: grid, gap: "12px", alignItems: "center", pl: "20px", pr: "12px", fontVariantNumeric: "tabular-nums"}}>
                    <Box component="span" sx={{fontFamily: font.display, fontSize: 20, fontWeight: 800}}>
                      Round {r.roundNumber}
                    </Box>
                    <Box component="span" sx={{fontSize: 15, color: color.inkSoft}}>
                      {displayDate(r.date)}
                    </Box>
                    <Box component="span" sx={{textAlign: "center", fontSize: 15, color: color.inkSoft}}>
                      {r.tables}
                    </Box>
                    <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px", fontSize: 13, fontWeight: 700, color: st.ink}}>
                      <Box component="span" aria-hidden sx={{width: 8, height: 8, borderRadius: "50%", background: st.ink}} />
                      {st.label}
                    </Box>
                    <Box component="span" sx={{display: "flex", justifyContent: "flex-end"}}>
                      {!asking && (
                        <Box
                          component="button"
                          type="button"
                          onClick={() => setConfirm(k)}
                          aria-label={`Delete Round ${r.roundNumber}, ${displayDate(r.date)}`}
                          sx={{...small, pl: "10px", pr: "14px", color: color.red, display: "flex", alignItems: "center", gap: "6px", "& svg": {fontSize: 20}, "&:hover": {background: "rgba(188,71,73,.08)"}}}
                        >
                          <DeleteRoundedIcon />
                          Delete
                        </Box>
                      )}
                    </Box>
                  </Box>
                  {asking && (
                    <Box
                      role="alert"
                      sx={{display: "flex", alignItems: "center", gap: "12px", m: "0 12px 12px 20px", p: "12px 12px 12px 16px", borderRadius: "16px", background: color.card, border: "1.5px solid rgba(188,71,73,.35)", "& > svg": {fontSize: 24, color: color.red, flex: "none"}}}
                    >
                      <WarningRoundedIcon />
                      <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                        <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
                          Delete Round {r.roundNumber} · {displayDate(r.date)}?
                        </Box>
                        <Box component="span" sx={{fontSize: 13, color: color.inkSoft}}>
                          {warning(r)}
                        </Box>
                      </Box>
                      <Box component="button" type="button" onClick={() => setConfirm(null)} sx={{...small, border: "1.5px solid rgba(60,74,103,.25)", color: color.navy}}>
                        Cancel
                      </Box>
                      <Box component="button" type="button" onClick={() => remove(r)} sx={{...small, background: color.red, color: "#FFFFFF"}}>
                        Delete round
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Card>
      <Box sx={{display: "flex", flexDirection: "column", gap: "16px"}}>
        <Box role="status" sx={{display: "contents"}}>
        {pending && (
          <Card sx={{borderRadius: "24px", p: "16px 18px", display: "flex", alignItems: "center", gap: "12px", "& > svg": {fontSize: 24, color: color.green}}}>
            <CheckCircleRoundedIcon />
            <Box component="span" sx={{flex: 1, fontSize: 14, fontWeight: 600}}>
              Round {pending.round.roundNumber} · {displayDate(pending.round.date)} deleted
            </Box>
            <Box component="button" type="button" onClick={undo} sx={{...buttonBase, height: 40, px: "14px", borderRadius: "10px", background: color.paper, color: color.navy, fontSize: 14, fontWeight: 700}}>
              Undo
            </Box>
          </Card>
        )}
        </Box>
        <InfoNote icon={<InfoRoundedIcon />}>Deleting a round removes its tables and any recorded hands. Daily and league standings are recalculated.</InfoNote>
      </Box>
    </Box>
  );
}
