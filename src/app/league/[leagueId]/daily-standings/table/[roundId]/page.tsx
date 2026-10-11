"use client";

import {addHandAPI, deleteHandAPI, finishTableMatchAPI, getTablePadAPI, HandTarget, updateHandAPI} from "@/app/_fetchers/admin/daily";
import {PadHand, PadMatch, TablePad} from "@/app/_interfaces/adminHand";
import useIsAdmin from "@/app/_hooks/useIsAdmin";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {blankEntry, EntryState, fromPadHand, toAdminHand} from "@/app/_lib/ui/adminEntry";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {color, teamColor} from "@/app/_styles/tokens";
import {buttonBase, Card, CenteredSpinner, DesktopShell, EmptyState, ErrorNote, Screen} from "@/app/_ui/sp";
import {HandList, ScorePanel} from "@/app/ongoing-match/ui/BoardParts";
import AdminEntryPanel from "@/app/league/[leagueId]/daily-standings/table/AdminEntryPanel";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import HistoryEduRoundedIcon from "@mui/icons-material/HistoryEduRounded";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import React, {useCallback, useEffect, useState} from "react";

const THRESHOLD = MATCH_THRESHOLD;

// The admin scorepad of one Daily table: every hand of its matches, finished or being played, can be added,
// changed or deleted, also as a custom hand ("Custom"). Desktop only, like the design.
export default function TableScorepad() {
  const params = useParams<{leagueId: string; roundId: string}>();
  const leagueId = Number(params.leagueId);
  const roundId = Number(params.roundId);
  const isDesktop = useIsDesktop();
  const isAdmin = useIsAdmin();
  const router = useTransitionRouter();

  const [pad, setPad] = useState<TablePad | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [entry, setEntry] = useState<EntryState>(blankEntry());
  const [editing, setEditing] = useState<PadHand | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPad(await getTablePadAPI(roundId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Stol nije moguće učitati.");
    }
  }, [roundId]);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  // a table still to be played: confirm who plays first, as players do on Start Game (the ratings need it)
  const needsLineup = pad != null && !pad.done && !pad.bye && !pad.hasLineup;
  useEffect(() => {
    if (needsLineup) router.replace(`/round/lineup/${roundId}?league=${leagueId}`);
  }, [needsLineup, router, roundId, leagueId]);

  // the matches to choose from; a table still in play without a match running gets the next one to start
  const matches: PadMatch[] = pad ? [...pad.matches] : [];
  if (pad && !pad.done && !matches.some((m) => m.kind === "ongoing") && matches.length < 2) {
    matches.push({kind: "ongoing", id: 0, number: matches.length + 1, score1: 0, score2: 0, threshold: THRESHOLD, winner: null, hands: []});
  }
  const match = matches.find((m) => m.number === selected) ?? matches[matches.length - 1] ?? null;
  const wins: [number, number] = [0, 0];
  for (const m of matches) if (m.kind === "finished" && m.winner) wins[m.winner - 1]++;

  const resetEntry = (keepMode = true) => {
    setEntry((s) => blankEntry(keepMode ? s.mode : "std"));
    setEditing(null);
    setError(null);
  };
  const pickMatch = (n: number) => {
    setSelected(n);
    resetEntry();
  };
  const openHand = (id: number) => {
    const h = match?.hands.find((x) => x.id === id);
    if (!h) return;
    setEditing(h);
    setEntry(fromPadHand(h));
    setError(null);
  };

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      await load();
      resetEntry();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    }
    setSaving(false);
  };
  const save = () => {
    if (!match || saving) return;
    const hand = toAdminHand(entry);
    if (editing) return run(() => updateHandAPI(match.kind, editing.id, hand), "Igra nije spremljena.");
    const target: HandTarget = match.kind === "finished" ? {kind: "finished", matchId: match.id} : {kind: "ongoing"};
    return run(() => addHandAPI(roundId, target, hand), "Igra nije spremljena.");
  };
  const remove = () => {
    if (!match || !editing) return;
    run(() => deleteHandAPI(match.kind, editing.id), "Igra nije obrisana.");
  };
  const finish = () =>
    run(async () => {
      await finishTableMatchAPI(roundId);
      setSelected(null); // show the next match (or the last one when the round is over)
    }, "Meč nije završen.");

  if (!isDesktop) {
    return (
      <Screen>
        <Card>
          <EmptyState>Uređivanje stolova radi na računalu.</EmptyState>
        </Card>
      </Screen>
    );
  }

  const back = pad?.date && pad.roundNumber ? {label: `Round ${pad.roundNumber}`, href: `/league/${leagueId}/daily-standings?date=${pad.date}&round=${pad.roundNumber}`} : {label: "Daily", href: `/league/${leagueId}/daily-standings`};
  const names: [string, string] = pad ? [pad.team1.name, pad.team2.name] : ["", ""];
  const state = !pad ? "" : pad.done ? `Meč ${match?.number ?? 1} · završeno` : match?.kind === "ongoing" && match.id === 0 && match.number === 1 ? "nije počelo" : "uživo";

  return (
    <DesktopShell
      active="daily"
      back={back}
      eyebrow={pad ? `Stol ${pad.table ?? "–"} · Round ${pad.roundNumber ?? "–"} · ${state}` : "Admin"}
      title={pad ? `${pad.team1.name} vs ${pad.team2.name}` : "Stol"}
      right={
        <Box sx={{height: 36, display: "flex", alignItems: "center", gap: "6px", pl: "10px", pr: "14px", borderRadius: "18px", background: color.navy, color: "#FFFFFF", fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", "& svg": {fontSize: 18}}}>
          <AdminPanelSettingsRoundedIcon />
          Admin · uređivanje
        </Box>
      }
    >
      {!isAdmin ? (
        <Card>
          <EmptyState>Samo administrator može uređivati stolove.</EmptyState>
        </Card>
      ) : loadError ? (
        <ErrorNote onRetry={load}>{loadError}</ErrorNote>
      ) : !pad || !match || needsLineup ? (
        <CenteredSpinner />
      ) : pad.bye ? (
        <Card>
          <EmptyState>Za ovim stolom je slobodna runda (bye), nema igara za uređivanje.</EmptyState>
        </Card>
      ) : (
        <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 460px", gap: "20px"}}>
          <Box sx={{minHeight: 0, display: "flex", flexDirection: "column", gap: "14px"}}>
            {(matches.length > 1 || pad.done) && (
              <Box sx={{display: "grid", gridTemplateColumns: `repeat(${matches.length}, minmax(0,1fr))${pad.done ? " minmax(0,1.3fr)" : ""}`, gap: "10px", alignItems: "stretch"}}>
                {matches.map((m) => {
                  const on = m.number === match.number;
                  const sub = m.kind === "ongoing" ? (m.id ? "U tijeku" : "Nije počeo") : m.winner ? `Pobjeda: ${names[m.winner - 1]}` : "Bez pobjednika";
                  return (
                    <Box
                      key={m.number}
                      component="button"
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickMatch(m.number)}
                      sx={{
                        ...buttonBase,
                        height: 56,
                        borderRadius: "16px",
                        background: on ? color.navy : color.card,
                        color: on ? "#FFFFFF" : color.ink,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "1px",
                        boxShadow: "0 1px 3px rgba(31,36,51,.06)",
                        transition: "background 160ms ease",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <Box component="span" sx={{fontSize: 15, fontWeight: 700}}>
                        Meč {m.number} · {m.score1} : {m.score2}
                      </Box>
                      <Box component="span" sx={{fontSize: 12, fontWeight: 600, color: on ? color.cream : color.muted}}>
                        {sub}
                      </Box>
                    </Box>
                  );
                })}
                {pad.done && (
                  <Box sx={{display: "flex", alignItems: "center", gap: "10px", px: "14px", borderRadius: "16px", background: "rgba(212,168,44,.16)", fontSize: 13, lineHeight: 1.35, "& svg": {fontSize: 20, color: color.medal[0], flex: "none"}}}>
                    <HistoryEduRoundedIcon />
                    Runda je završena. Izmjene mijenjaju rezultat i poredak.
                  </Box>
                )}
              </Box>
            )}
            <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "14px"}}>
              {([0, 1] as const).map((i) => (
                <ScorePanel
                  key={i}
                  index={i}
                  name={names[i]}
                  wins={wins[i]}
                  total={i ? match.score2 : match.score1}
                  threshold={match.threshold}
                  celebrate={match.winner === i + 1}
                  size="desktop"
                />
              ))}
            </Box>
            <HandList
              size="desktop"
              rows={match.hands.map((h) => ({id: h.id, left: h.total1, right: h.total2}))}
              selectedId={editing?.id ?? null}
              onOpen={openHand}
            />
          </Box>
          <AdminEntryPanel
            entry={entry}
            onChange={setEntry}
            names={names}
            title={editing ? `Uredi igru ${match.hands.findIndex((h) => h.id === editing.id) + 1}` : `Igra ${match.hands.length + 1}`}
            editing={editing != null}
            saving={saving}
            error={error}
            onSave={save}
            onCancel={() => resetEntry()}
            onDelete={remove}
            finish={
              match.kind === "ongoing" && match.id && match.winner
                ? {winner: names[match.winner - 1], color: teamColor[match.winner - 1], onFinish: finish, busy: saving}
                : null
            }
          />
        </Box>
      )}
    </DesktopShell>
  );
}
