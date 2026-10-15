"use client";

import {addHandAPI, deleteHandAPI, finishTableMatchAPI, getTablePadAPI, HandTarget, updateHandAPI} from "@/app/_fetchers/admin/daily";
import {getLineupAPI} from "@/app/_fetchers/round/lineup";
import {PadMatch, TablePad} from "@/app/_interfaces/adminHand";
import type {Lineup} from "@/app/_lib/service/round/lineup";
import {nightLabel} from "@/app/_lib/nights";
import {blankEntry, canSave, clearPoints, EntryState, fromPadHand, setActive, switchMode, toAdminHand, typeDigit} from "@/app/_lib/ui/adminEntry";
import {dostaCallers, MATCH_THRESHOLD, PlayedHand, Side} from "@/app/_lib/game/scoring";
import {navigateWithTransition, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, teamColor, tint} from "@/app/_styles/tokens";
import {
  ActionPair,
  buttonBase,
  CenteredSpinner,
  ConfirmSheet,
  ellipsis,
  EmptyState,
  ErrorNote,
  ErrorState,
  Eyebrow,
  IconCircleButton,
  InfoNote,
  PrimaryButton,
  Screen,
  ScreenTitle,
  ScrollArea,
  SectionLabel,
  tabular,
  TopBar,
} from "@/app/_ui/sp";
import {HandList, ScorePanel} from "@/app/ongoing-match/ui/BoardParts";
import RoundResultCards from "@/app/ongoing-match/ui/RoundResultCards";
import {DostaPrompt, DostaTeam, TargetFlag} from "@/app/ongoing-match/ui/MatchEnd";
import {PointsKeypad, TeamValueBoxes} from "@/app/ongoing-match/ui/WizardParts";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HistoryEduRoundedIcon from "@mui/icons-material/HistoryEduRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useState} from "react";
import AdminBadge from "./AdminBadge";

const THRESHOLD = MATCH_THRESHOLD;
const MATCHES = 2;
// Treseta: "1" a normal hand (the 11-split), "rucni" a custom hand ("Custom"); Bela's steps 2 and 3 open "1"
type Step = "1" | "2" | "3" | "rucni";

const playedHands = (m: PadMatch): PlayedHand[] =>
  m.hands.map((h) => ({team1_game_points: h.total1, team2_game_points: h.total2, dosta_side: h.dosta}));

// How many entry steps were opened from the board in this tab, so saving goes back to the board in the browser's
// history too (a reload in the middle doesn't know, and replaces the address instead)
let stepsFromBoard = 0;

// One of the table's two matches: played (finished), being played (ongoing with id), or not started (the next one,
// ongoing without id; its first hand starts it)
function matchSlot(pad: TablePad, n: number): PadMatch | null {
  const found = pad.matches.find((m) => m.number === n);
  if (found) return found;
  const next = pad.matches.filter((m) => m.kind === "finished").length + 1;
  if (pad.done || n !== next || pad.matches.some((m) => m.kind === "ongoing")) return null;
  return {kind: "ongoing", id: 0, number: n, score1: 0, score2: 0, threshold: THRESHOLD, winner: null, hands: []};
}

function roundWins(pad: TablePad): [number, number] {
  const wins: [number, number] = [0, 0];
  for (const m of pad.matches) if (m.kind === "finished" && m.winner) wins[m.winner - 1]++;
  return wins;
}

// The table on the admin's phone (admin-mobile 23–29), at the address of the desktop's scorepad:
//   (none)       Stol: both teams, the two matches, who plays, and Nastavi meč
//   ?mec=N       Meč N: the scoreboard as players see it; a hand opens for correcting, Upiši igru adds one
//   &igra=new|ID&korak=1|rucni  entering or correcting a hand: a normal one (the players' keypad) or Custom
//   ?kraj=1      Kraj kola, after the second match is finished
// Every change goes through the admin's calls (the server recounts the standings and the ratings), so finished
// matches can be corrected too.
export default function TablePhone() {
  const params = useParams<{leagueId: string; roundId: string}>();
  const leagueId = Number(params.leagueId);
  const roundId = Number(params.roundId);
  const search = useSearchParams();
  const mec = Number(search.get("mec")) || null;
  const igra = search.get("igra");
  const korak = (search.get("korak") as Step | null) ?? null;
  const kraj = search.get("kraj") === "1";

  const [pad, setPad] = useState<TablePad | null>(null);
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([getTablePadAPI(roundId), getLineupAPI(roundId).catch(() => null)]);
      setPad(p);
      setLineup(l);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Stol se nije učitao.");
    }
  }, [roundId]);

  useEffect(() => {
    load();
  }, [load]);
  // while the table is played, its matches come in every 15 s and when the app is back in front (not while a hand
  // is being entered, which keeps what it opened)
  const live = pad != null && !pad.done && !korak;
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(load, 15000);
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [live, load]);

  if (loadError && !pad) {
    return (
      <Screen>
        <ErrorState title="Stol se nije učitao" onRetry={load} />
      </Screen>
    );
  }
  if (!pad) {
    return (
      <Screen fill>
        <CenteredSpinner />
      </Screen>
    );
  }
  const base = `/league/${leagueId}/daily-standings/table/${roundId}`;
  if (kraj) return <RoundEnd pad={pad} base={base} />;
  if (mec) return <MatchPhone key={mec} pad={pad} base={base} number={mec} igra={igra} korak={korak} reload={load} />;
  return <TableHub pad={pad} lineup={lineup} base={base} leagueId={leagueId} />;
}

// Stol (23): the teams with their wins in the round, the matches (a tap opens one to enter or correct), who plays,
// and the next match
function TableHub({pad, lineup, base, leagueId}: {pad: TablePad; lineup: Lineup | null; base: string; leagueId: number}) {
  const router = useTransitionRouter();
  const wins = roundWins(pad);
  const names: [string, string] = [pad.team1.name, pad.team2.name];
  const slots = Array.from({length: MATCHES}, (_, i) => pad.matches.find((m) => m.number === i + 1) ?? matchSlot(pad, i + 1));
  const next = slots.find((m) => m && !(m.kind === "finished"));
  const lineupHref = `/round/lineup/${pad.roundId}?league=${leagueId}`;
  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push(`/league/${leagueId}/daily-standings${pad.date ? `?date=${pad.date}${pad.roundNumber ? `&round=${pad.roundNumber}` : ""}` : ""}`, "back");
  };
  const players = (teamId: number) => {
    const t = lineup?.teams.find((x) => x.id === teamId);
    if (!t || !lineup?.saved) return null;
    const picked = t.members.filter((m) => t.selected.includes(m.id)).map((m) => m.name);
    return picked.length ? picked.join(" · ") : null;
  };

  return (
    <Screen fill gap={14}>
      <TopBar
        onBack={back}
        backLabel={pad.roundNumber ? `Natrag na kolo ${pad.roundNumber}` : "Natrag"}
        eyebrow={[pad.roundNumber && `Kolo ${pad.roundNumber}`, pad.date && nightLabel(pad.date)].filter(Boolean).join(" · ")}
        title={`Stol ${pad.table ?? "–"}`}
        right={<AdminBadge />}
      />
      {pad.bye ? (
        <EmptyState>Za ovim stolom je slobodna runda, nema igara.</EmptyState>
      ) : (
        <>
          <ScrollArea sx={{gap: "14px"}}>
            <Box component="section" aria-label="Pobjede u kolu" sx={{flex: "none", background: color.white, borderRadius: "22px", boxShadow: shadow.card, px: "16px"}}>
              {([0, 1] as const).map((i) => (
                <Box key={i} sx={{height: 58, display: "flex", alignItems: "center", gap: "10px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
                  <Box component="span" aria-hidden sx={{width: 8, height: 8, flex: "none", borderRadius: "50%", background: teamColor[i]}} />
                  <Box component="span" sx={{flex: 1, minWidth: 0, fontSize: 17, fontWeight: wins[i] > wins[1 - i] ? 700 : 600, ...ellipsis}}>
                    {names[i]}
                  </Box>
                  <Box component="span" sx={{fontFamily: font.display, fontSize: 28, fontWeight: 800, ...tabular}}>
                    {wins[i]}
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{flex: "none", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", px: "6px"}}>
              <SectionLabel sx={{px: 0}}>Mečevi</SectionLabel>
              <Box component="span" sx={{fontSize: 13, color: color.muted, textAlign: "right"}}>
                Dodirni meč za upis ili ispravak
              </Box>
            </Box>
            <Box component="ul" aria-label="Mečevi" sx={{flex: "none", listStyle: "none", m: 0, p: 0, background: color.white, borderRadius: "22px", overflow: "hidden", boxShadow: shadow.card}}>
              {slots.map((m, i) => {
                const n = i + 1;
                const st = !m ? "new" : m.kind === "finished" ? "done" : m.id ? "live" : "new";
                const look = {done: ["Završen", tint.green[12], color.green], live: ["U tijeku", tint.red[10], color.red], new: ["Nije počeo", color.lineFill, color.muted]}[st];
                const can = m != null;
                const open = () => {
                  if (!can) return;
                  if (st === "new" && !pad.hasLineup) router.push(lineupHref);
                  else router.push(`${base}?mec=${n}`);
                };
                return (
                  <Box component="li" key={n} sx={{borderTop: i ? `1px solid ${color.line}` : "none"}}>
                    <Box
                      component="button"
                      type="button"
                      onClick={open}
                      disabled={!can}
                      aria-label={`Meč ${n}, ${look[0].toLowerCase()}${m && st !== "new" ? `, ${m.score1} : ${m.score2}` : ""}`}
                      sx={{...buttonBase, width: "100%", minHeight: 76, display: "flex", alignItems: "center", gap: "12px", p: "10px 12px 10px 16px", textAlign: "left", opacity: can ? 1 : 0.5, "&:active:not(:disabled)": {background: color.paper2}}}
                    >
                      <Box component="span" sx={{flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px"}}>
                        <Box component="span" sx={{fontSize: 16, fontWeight: 700, color: color.ink}}>
                          Meč {n}
                        </Box>
                        <Box component="span" sx={{height: 24, display: "flex", alignItems: "center", px: "8px", borderRadius: "7px", background: look[1], color: look[2], fontSize: 13, fontWeight: 700}}>
                          {look[0]}
                        </Box>
                      </Box>
                      <Box component="span" aria-hidden sx={{flex: 1, minWidth: 0, textAlign: "right", fontFamily: font.display, fontSize: 30, fontWeight: 800, whiteSpace: "nowrap", ...tabular}}>
                        {m && st !== "new" ? (
                          <>
                            <Box component="span" sx={{color: color.green}}>
                              {m.score1}
                            </Box>
                            <Box component="span" sx={{color: color.faint, mx: "4px"}}>
                              :
                            </Box>
                            <Box component="span" sx={{color: color.red}}>
                              {m.score2}
                            </Box>
                          </>
                        ) : (
                          <Box component="span" sx={{color: color.faint}}>
                            – : –
                          </Box>
                        )}
                      </Box>
                      <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 24, color: color.navy, opacity: can ? 1 : 0}} />
                    </Box>
                  </Box>
                );
              })}
            </Box>

            <SectionLabel>Tko igra ovu rundu</SectionLabel>
            <Box sx={{flex: "none", background: color.white, borderRadius: "22px", boxShadow: shadow.card, px: "16px"}}>
              {([pad.team1, pad.team2] as const).map((t, i) => {
                const who = players(t.id);
                return (
                  <Box key={t.id} sx={{minHeight: 60, display: "flex", alignItems: "center", gap: "10px", py: "8px", borderTop: i ? `1px solid ${color.line}` : "none"}}>
                    <Box component="span" aria-hidden sx={{width: 8, height: 8, flex: "none", borderRadius: "50%", background: teamColor[i]}} />
                    <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
                      <Box component="span" sx={{fontSize: 15, fontWeight: 700, ...ellipsis}}>
                        {t.name}
                      </Box>
                      <Box component="span" sx={{fontSize: 13.5, color: who ? color.ink2 : color.red, ...ellipsis}}>
                        {who ?? "Nije potvrđeno"}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
              <Box
                component="button"
                type="button"
                onClick={() => router.push(lineupHref)}
                sx={{...buttonBase, width: "100%", height: 52, display: "flex", alignItems: "center", gap: "10px", borderTop: `1px solid ${color.line}`, color: color.navy, fontSize: 15, fontWeight: 600, textAlign: "left", "& svg": {fontSize: 22}}}
              >
                <GroupsRoundedIcon aria-hidden />
                <Box component="span" sx={{flex: 1}}>
                  {pad.hasLineup ? "Promijeni igrače" : "Potvrdi tko igra"}
                </Box>
                <ChevronRightRoundedIcon aria-hidden />
              </Box>
            </Box>
            {pad.done && (
              <InfoNote icon={<HistoryEduRoundedIcon />}>Runda je završena. Izmjene mijenjaju rezultat i poredak.</InfoNote>
            )}
          </ScrollArea>
          {next && (
            <PrimaryButton
              icon={!pad.hasLineup && next.id === 0 && next.number === 1 ? <GroupsRoundedIcon /> : <PlayArrowRoundedIcon />}
              onClick={() => (!pad.hasLineup && next.id === 0 && next.number === 1 ? router.push(lineupHref) : router.push(`${base}?mec=${next.number}`))}
            >
              {!pad.hasLineup && next.id === 0 && next.number === 1 ? "Potvrdi igrače i počni" : next.id ? `Nastavi meč ${next.number}` : `Počni meč ${next.number}`}
            </PrimaryButton>
          )}
        </>
      )}
    </Screen>
  );
}

// Meč N (25) and the hand entry over it (Treseta: a normal hand or Custom, then "s ovim dosta"), with the match's hand being entered in local state
function MatchPhone({pad, base, number, igra, korak, reload}: {pad: TablePad; base: string; number: number; igra: string | null; korak: Step | null; reload: () => Promise<void>}) {
  const router = useTransitionRouter();
  const match = matchSlot(pad, number);
  const names: [string, string] = [pad.team1.name, pad.team2.name];
  const [entry, setEntry] = useState<EntryState>(blankEntry());
  // which hand the entry holds ("new" or its id); null: none yet
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // after a custom hand: ask about "s ovim dosta" on the match's last hand (null: the hand just added)
  const [askDosta, setAskDosta] = useState<{hand: number | null} | null>(null);
  const [dostaError, setDostaError] = useState<string | null>(null);

  const editingId = igra && igra !== "new" ? Number(igra) : null;
  const editing = editingId != null ? match?.hands.find((h) => h.id === editingId) ?? null : null;

  // the hand opened (or a reload in the middle of entering it): the entry starts from it, or empty
  useEffect(() => {
    if (!igra || igra === entryFor) return;
    if (igra === "new") setEntry(blankEntry(korak === "rucni" ? "man" : "std"));
    else if (editing) setEntry(fromPadHand(editing));
    else return;
    setEntryFor(igra);
    setError(null);
  }, [igra, entryFor, editing, korak]);

  const board = `${base}?mec=${number}`;
  const step = (k: Step, hand = igra ?? "new") => {
    stepsFromBoard += 1;
    router.push(`${board}&igra=${hand}&korak=${k}`);
  };
  const stepBack = () => {
    stepsFromBoard = Math.max(0, stepsFromBoard - 1);
    router.back();
  };
  const toBoard = () => {
    const n = stepsFromBoard;
    stepsFromBoard = 0;
    setEntryFor(null);
    if (n > 0) navigateWithTransition(() => window.history.go(-n), "back");
    else router.replace(board, "back");
  };

  if (!match) {
    return (
      <Screen>
        <TopBar onBack={() => router.replace(base, "back")} title={`Meč ${number}`} />
        <EmptyState>Ovaj meč još ne može početi.</EmptyState>
      </Screen>
    );
  }

  const run = async (action: () => Promise<unknown>, fallback: string, after?: () => void) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      await reload();
      setSaving(false);
      setAskDelete(false);
      toBoard();
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
      setSaving(false);
    }
  };
  const save = () => {
    if (!canSave(entry) || saving) return;
    const hand = toAdminHand(entry);
    const ask = hand.custom ? () => setAskDosta({hand: editing?.id ?? null}) : undefined;
    if (editing) return run(() => updateHandAPI(match.kind, editing.id, hand), "Igra nije spremljena.", ask);
    const target: HandTarget = match.kind === "finished" ? {kind: "finished", matchId: match.id} : {kind: "ongoing"};
    return run(() => addHandAPI(pad.roundId, target, hand), "Igra nije spremljena.", ask);
  };
  const remove = () => editing && run(() => deleteHandAPI(match.kind, editing.id), "Igra nije obrisana.");

  const handNumber = editing ? match.hands.findIndex((h) => h.id === editing.id) + 1 : match.hands.length + 1;
  const deleteSheet = (
    <ConfirmSheet
      open={askDelete}
      onClose={() => setAskDelete(false)}
      onConfirm={remove}
      title="Obrisati igru?"
      text="Bodovi te igre oduzimaju se od zbroja meča."
      action="Obriši igru"
      icon={<DeleteRoundedIcon />}
      busy={saving}
      error={askDelete ? error : null}
    />
  );
  // Custom (each team's points typed on their own) and, for a saved hand, Obriši igru
  const extras = (manual: boolean) => (
    <Box sx={{flex: "none", display: "flex", justifyContent: editing ? "space-between" : "center", gap: "8px", pb: "10px"}}>
      {!manual ? (
        <Box
          component="button"
          type="button"
          onClick={() => {
            setEntry((s) => switchMode(s, "man"));
            step("rucni");
          }}
          sx={{...buttonBase, height: 44, px: "12px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "6px", color: color.navy, fontSize: 15, fontWeight: 600, "& svg": {fontSize: 20}}}
        >
          <EditNoteRoundedIcon aria-hidden />
          Custom
        </Box>
      ) : (
        <Box component="span" />
      )}
      {editing && (
        <Box
          component="button"
          type="button"
          onClick={() => setAskDelete(true)}
          sx={{...buttonBase, height: 44, px: "12px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "6px", color: color.red, fontSize: 15, fontWeight: 600, "& svg": {fontSize: 20}}}
        >
          <DeleteRoundedIcon aria-hidden />
          Obriši igru
        </Box>
      )}
    </Box>
  );

  // ---------- the steps ----------
  if (korak && igra && entryFor === igra) {
    const wizard = (children: React.ReactNode) => (
      <Screen fill gap={0} sx={{pt: "calc(22px + env(safe-area-inset-top))"}}>
        {children}
        {error && !askDelete && <ErrorNote sx={{mb: "10px"}}>{error}</ErrorNote>}
        {deleteSheet}
      </Screen>
    );
    const active: 0 | 1 = entry.active === 2 ? 1 : 0;
    const pick = (i: 0 | 1) => setEntry((s) => setActive(s, i === 1 ? 2 : 1));
    if (korak !== "rucni") {
      // a normal hand: the typed team's points, and the rest of 11 to the other team
      return wizard(
        <>
          <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "12px", pb: "12px", flex: "none"}}>
            <Eyebrow sx={{px: "4px"}}>{editing ? `Igra ${handNumber} · uredi` : `Igra ${handNumber}`}</Eyebrow>
            <TeamValueBoxes names={names} label="Igra" values={entry.points} active={active} onPick={pick} />
          </Box>
          <PointsKeypad onDigit={(d) => setEntry((s) => typeDigit(s, d))} onClear={() => setEntry((s) => clearPoints(s))} />
          {extras(false)}
          <ActionPair onBack={stepBack} nextLabel="Spremi" onNext={save} nextDisabled={!canSave(entry)} nextLoading={saving} />
        </>
      );
    }
    // Custom: each team's points typed on their own (e.g. for "s ovim dosta"), up to 99
    return wizard(
      <>
        <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "12px", pb: "12px", flex: "none"}}>
          <ScreenTitle eyebrow={`Igra ${handNumber}`} title="Custom" size={32} sx={{pt: 0}} />
          <TeamValueBoxes names={names} label="Bodovi" values={entry.points} active={active} onPick={pick} />
          <Box component="p" sx={{m: 0, px: "4px", fontSize: 13.5, lineHeight: 1.4, color: color.ink2}}>
            Bodovi svake ekipe upisuju se zasebno, npr. za „s ovim dosta”.
          </Box>
        </Box>
        <PointsKeypad onDigit={(d) => setEntry((s) => typeDigit(s, d))} onClear={() => setEntry((s) => clearPoints(s))} />
        {editing && extras(true)}
        <ActionPair
          onBack={() => {
            setEntry((s) => (editing?.custom ? s : switchMode(s, "std")));
            stepBack();
          }}
          nextLabel="Spremi"
          onNext={save}
          nextDisabled={!canSave(entry)}
          nextLoading={saving}
        />
      </>
    );
  }

  // ---------- the board ----------
  const wins = roundWins(pad);
  const finishable = match.kind === "ongoing" && match.id !== 0 && match.winner != null;
  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      await finishTableMatchAPI(pad.roundId);
      await reload();
      // after the second match: Kraj kola; after the first: the next match's board
      router.replace(number >= MATCHES ? `${base}?kraj=1` : `${base}?mec=${number + 1}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Meč nije završen.");
    }
    setFinishing(false);
  };
  const openHand = (id: number) => {
    const h = match.hands.find((x) => x.id === id);
    if (h) step(h.custom ? "rucni" : "1", String(id));
  };

  // the teams that reached the target with that custom hand (none: nothing to ask)
  const askHand = match.hands[match.hands.length - 1];
  const dostaTeams: DostaTeam[] =
    askDosta && askHand?.custom && !askHand.dosta && (askDosta.hand == null || askDosta.hand === askHand.id)
      ? dostaCallers(playedHands(match), THRESHOLD).map((side) => ({side, name: names[side - 1], color: teamColor[side - 1]}))
      : [];
  const pickDosta = async (side: Side) => {
    if (!askHand) return;
    setSaving(true);
    setDostaError(null);
    try {
      await updateHandAPI(match.kind, askHand.id, {custom: true, points1: askHand.total1, points2: askHand.total2, dosta: side});
      await reload();
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

  return (
    <Screen fill gap={0} sx={{pt: "calc(14px + env(safe-area-inset-top))"}}>
      <Box sx={{display: "flex", flexDirection: "column", gap: "12px"}}>
        <Box sx={{height: 44, display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 44px", alignItems: "center", mx: "-6px"}}>
          <IconCircleButton label="Natrag na stol" size={44} onClick={() => (window.history.length > 1 ? router.back() : router.replace(base, "back"))} sx={{"& svg": {fontSize: 26}}}>
            <ChevronLeftRoundedIcon />
          </IconCircleButton>
          <Eyebrow sx={{textAlign: "center", ...ellipsis}}>
            Stol {pad.table ?? "–"} · Meč {number} od {MATCHES}
          </Eyebrow>
          <AdminBadge />
        </Box>
        <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px"}}>
          {([0, 1] as const).map((i) => (
            <ScorePanel key={i} index={i} name={names[i]} wins={wins[i]} total={i ? match.score2 : match.score1} threshold={match.threshold} celebrate={match.winner === i + 1} />
          ))}
        </Box>
      </Box>
      {dostaTeams.length === 0 && match.threshold > THRESHOLD && (
        <Box sx={{display: "flex", justifyContent: "center", pt: "12px"}}>
          <TargetFlag target={match.threshold} />
        </Box>
      )}
      <HandList rows={match.hands.map((h) => ({id: h.id, left: h.total1, right: h.total2}))} onOpen={openHand} sx={{mt: "14px"}} />
      <Box sx={{pt: "14px", display: "flex", flexDirection: "column", gap: "10px"}}>
        {pad.done && <InfoNote icon={<HistoryEduRoundedIcon />}>Runda je završena. Izmjene mijenjaju rezultat i poredak.</InfoNote>}
        {error && <ErrorNote>{error}</ErrorNote>}
        {finishable ? (
          <PrimaryButton icon={<DoneRoundedIcon />} bg={teamColor[match.winner! - 1]} onClick={finish} loading={finishing}>
            Završi meč
          </PrimaryButton>
        ) : (
          <PrimaryButton icon={<AddCircleRoundedIcon />} onClick={() => step("1", "new")}>
            Upiši igru
          </PrimaryButton>
        )}
      </Box>
      <DostaPrompt teams={dostaTeams} onPick={pickDosta} onSkip={skipDosta} busy={saving} error={dostaError} />
    </Screen>
  );
}

// Kraj kola (29): the round's wins and the matches, then back to the table
function RoundEnd({pad, base}: {pad: TablePad; base: string}) {
  const router = useTransitionRouter();
  return (
    <Screen>
      <ScreenTitle eyebrow="Pobjede u kolu" title="Kraj kola" size={40} sx={{pb: "8px"}} />
      <RoundResultCards
        names={[pad.team1.name, pad.team2.name]}
        wins={roundWins(pad)}
        matches={pad.matches.filter((m) => m.kind === "finished").map((m) => ({id: m.id, left: m.score1, right: m.score2}))}
      />
      <PrimaryButton icon={<ChevronLeftRoundedIcon />} onClick={() => router.replace(base, "back")} sx={{mt: "auto"}}>
        Natrag na stol
      </PrimaryButton>
    </Screen>
  );
}
