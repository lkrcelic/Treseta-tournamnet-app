"use client";

import {addHandAPI, deleteHandAPI, finishTableMatchAPI, getTablePadAPI, HandTarget, updateHandAPI} from "@/app/_fetchers/admin/daily";
import {PadHand, PadMatch, TablePad} from "@/app/_interfaces/adminHand";
import useAdminPhone from "@/app/_hooks/useAdminPhone";
import useIsAdmin from "@/app/_hooks/useIsAdmin";
import TablePhone from "@/app/_ui/admin/TablePhone";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import useShortWindow from "@/app/_hooks/useShortWindow";
import {blankEntry, EntryState, fromPadHand, toAdminHand} from "@/app/_lib/ui/adminEntry";
import {dostaCallers, MATCH_THRESHOLD, PlayedHand, Side} from "@/app/_lib/game/scoring";
import {leaveRoundPages, lineupPassed} from "@/app/_lib/ui/lineupPass";
import {color, shadow, teamColor, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, CenteredSpinner, DesktopShell, EmptyState, ErrorNote} from "@/app/_ui/sp";
import {HandList, ScorePanel} from "@/app/ongoing-match/ui/BoardParts";
import AdminEntryPanel from "@/app/league/[leagueId]/daily-standings/table/AdminEntryPanel";
import {DostaPrompt, DostaTeam, TargetFlag} from "@/app/ongoing-match/ui/MatchEnd";
import TablePreview from "@/app/league/[leagueId]/daily-standings/table/TablePreview";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import HistoryEduRoundedIcon from "@mui/icons-material/HistoryEduRounded";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import React, {useCallback, useEffect, useState} from "react";

const THRESHOLD = MATCH_THRESHOLD;

const playedHands = (m: PadMatch): PlayedHand[] =>
  m.hands.map((h) => ({team1_game_points: h.total1, team2_game_points: h.total2, dosta_side: h.dosta}));

// One Dnevni poredak table. For an admin it is the table's scorepad: every hand of its matches, finished or being
// played, can be added, changed or deleted, also as a custom hand ("Custom"); the admin's phone has its own layout of
// it (TablePhone). Anyone else gets Pregled stola, read-only, and the player whose own table it is, still to be
// played, goes into the game.
export default function TableScorepad() {
  const isDesktop = useIsDesktop();
  const isAdmin = useIsAdmin();
  const adminPhone = useAdminPhone();
  if (isDesktop && isAdmin) return <TableScorepadDesktop />;
  return adminPhone ? <TablePhone /> : <TablePreview />;
}

function TableScorepadDesktop() {
  const params = useParams<{leagueId: string; roundId: string}>();
  const leagueId = Number(params.leagueId);
  const roundId = Number(params.roundId);
  const isAdmin = useIsAdmin();
  const router = useTransitionRouter();
  // a short window (1024×640): a smaller header, so the entry panel needs less scrolling
  const short = useShortWindow();

  const [pad, setPad] = useState<TablePad | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [entry, setEntry] = useState<EntryState>(blankEntry());
  const [editing, setEditing] = useState<PadHand | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // after a custom hand: ask about "s ovim dosta" on the match's last hand (null: the hand just added)
  const [askDosta, setAskDosta] = useState<{match: number; hand: number | null} | null>(null);
  const [dostaError, setDostaError] = useState<string | null>(null);

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

  // every time the table is opened, who plays (or played) it first, as players do on Započni igru (the ratings need it)
  const needsLineup = pad != null && !pad.bye && !lineupPassed(roundId);
  useEffect(() => {
    if (needsLineup) router.replace(`/round/lineup/${roundId}?league=${leagueId}`);
  }, [needsLineup, router, roundId, leagueId]);
  useEffect(() => () => leaveRoundPages(roundId), [roundId]);

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

  const run = async (action: () => Promise<unknown>, fallback: string, after?: () => void) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      await load();
      resetEntry();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    }
    setSaving(false);
  };
  const save = () => {
    if (!match || saving) return;
    const hand = toAdminHand(entry);
    const ask = hand.custom ? () => setAskDosta({match: match.number, hand: editing?.id ?? null}) : undefined;
    if (editing) return run(() => updateHandAPI(match.kind, editing.id, hand), "Igra nije spremljena.", ask);
    const target: HandTarget = match.kind === "finished" ? {kind: "finished", matchId: match.id} : {kind: "ongoing"};
    return run(() => addHandAPI(roundId, target, hand), "Igra nije spremljena.", ask);
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

  const names: [string, string] = pad ? [pad.team1.name, pad.team2.name] : ["", ""];

  // the teams that reached the target with that custom hand (none: nothing to ask)
  const askMatch = askDosta ? matches.find((m) => m.number === askDosta.match) : undefined;
  const askHand = askMatch?.hands[askMatch.hands.length - 1];
  const dostaTeams: DostaTeam[] =
    askMatch && askHand?.custom && !askHand.dosta && (askDosta?.hand == null || askDosta.hand === askHand.id)
      ? dostaCallers(playedHands(askMatch), THRESHOLD).map((side) => ({side, name: names[side - 1], color: teamColor[side - 1]}))
      : [];
  const pickDosta = async (side: Side) => {
    if (!askMatch || !askHand) return;
    setSaving(true);
    setDostaError(null);
    try {
      const hand = {custom: true, points1: askHand.total1, points2: askHand.total2, dosta: side};
      await updateHandAPI(askMatch.kind, askHand.id, hand);
      await load();
      setAskDosta(null);
    } catch (e) {
      setDostaError(e instanceof Error ? e.message : "Nije spremljeno.");
    }
    setSaving(false);
  };
  const skipDosta = () => {
    setAskDosta(null);
    setDostaError(null);
  };

  const back = pad?.date && pad.roundNumber ? {label: `Kolo ${pad.roundNumber}`, href: `/league/${leagueId}/daily-standings?date=${pad.date}&round=${pad.roundNumber}`} : {label: "Dnevni poredak", href: `/league/${leagueId}/daily-standings`};
  const state = !pad ? "" : pad.done ? `Meč ${match?.number ?? 1} · završeno` : match?.kind === "ongoing" && match.id === 0 && match.number === 1 ? "nije počelo" : "uživo";

  return (
    <DesktopShell
      active="daily"
      compact={short}
      back={back}
      eyebrow={pad ? `Stol ${pad.table ?? "–"} · Kolo ${pad.roundNumber ?? "–"} · ${state}` : "Admin"}
      title={pad ? `${pad.team1.name} vs ${pad.team2.name}` : "Stol"}
      right={
        <Box sx={{display: "flex", alignItems: "center", gap: "10px"}}>
          {match && dostaTeams.length === 0 && <TargetFlag target={match.threshold} />}
          <Box sx={{height: 36, display: "flex", alignItems: "center", gap: "6px", pl: "10px", pr: "14px", borderRadius: "18px", background: color.navy, color: color.white, fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", "& svg": {fontSize: 18}}}>
            <AdminPanelSettingsRoundedIcon />
            Admin · uređivanje
          </Box>
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
          <EmptyState>Za ovim stolom je slobodna runda, nema igara za uređivanje.</EmptyState>
        </Card>
      ) : (
        <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 460px", gap: "20px"}}>
          <Box sx={{minHeight: 0, display: "flex", flexDirection: "column", gap: "14px"}}>
            {(matches.length > 1 || pad.done) && (
              <Box sx={{display: "grid", gridTemplateColumns: `repeat(${matches.length}, minmax(0,1fr))${pad.done ? " minmax(0,1.3fr)" : ""}`, gap: "10px", alignItems: "stretch"}}>
                {matches.map((m) => {
                  const on = m.number === match.number;
                  const result = m.kind === "ongoing" ? (m.id ? "U tijeku" : "Nije počeo") : m.winner ? `Pobjeda: ${names[m.winner - 1]}` : "Bez pobjednika";
                  const sub = m.threshold > MATCH_THRESHOLD ? `${result} · do ${m.threshold}` : result;
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
                        background: on ? color.navy : color.white,
                        color: on ? color.white : color.ink,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "1px",
                        boxShadow: shadow.card,
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
                  <Box sx={{display: "flex", alignItems: "center", gap: "10px", px: "14px", borderRadius: "16px", background: tint.gold[16], fontSize: 13, lineHeight: 1.35, "& svg": {fontSize: 20, color: color.medal[0], flex: "none"}}}>
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
      <DostaPrompt teams={dostaTeams} onPick={pickDosta} onSkip={skipDosta} busy={saving} error={dostaError} />
    </DesktopShell>
  );
}
