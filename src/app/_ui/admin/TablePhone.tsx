"use client";

import {addHandAPI, deleteHandAPI, finishTableMatchAPI, getTablePadAPI, HandTarget, updateHandAPI} from "@/app/_fetchers/admin/daily";
import {PadHand, PadMatch, TablePad} from "@/app/_interfaces/adminHand";
import {currentMatchNumber, matchSlots, matchTabSub, roundWins, TABLE_MATCHES} from "@/app/_lib/tableOverview";
import {blankEntry, canSave, clearPoints, EntryState, fromPadHand, manualFields, setActive, toAdminHand, typeDigit} from "@/app/_lib/ui/adminEntry";
import {dostaCallers, MATCH_THRESHOLD, PlayedHand, Side} from "@/app/_lib/game/scoring";
import {navigateWithTransition, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow, teamColor, tint} from "@/app/_styles/tokens";
import {
  ActionPair,
  BottomSheet,
  buttonBase,
  CenteredSpinner,
  ConfirmSheet,
  ellipsis,
  EmptyState,
  ErrorNote,
  ErrorState,
  Eyebrow,
  IconCircleButton,
  PrimaryButton,
  Screen,
  ScreenTitle,
  tabular,
} from "@/app/_ui/sp";
import {HandList, MatchTabs, ScorePanel} from "@/app/ongoing-match/ui/BoardParts";
import RoundResultCards from "@/app/ongoing-match/ui/RoundResultCards";
import {DostaPrompt, DostaTeam, TargetFlag} from "@/app/ongoing-match/ui/MatchEnd";
import {PointsKeypad, TeamValueBoxes} from "@/app/ongoing-match/ui/WizardParts";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import AdminPanelSettingsRoundedIcon from "@mui/icons-material/AdminPanelSettingsRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import {Box} from "@mui/material";
import {useParams, useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useState} from "react";

const THRESHOLD = MATCH_THRESHOLD;
// Treseta: one step, the players' keypad (the typed team's points and the rest of 11); Bela's steps 2 and 3 open it too
type Step = "1" | "2" | "3";

const playedHands = (m: PadMatch): PlayedHand[] =>
  m.hands.map((h) => ({team1_game_points: h.total1, team2_game_points: h.total2, dosta_side: h.dosta}));

// How many entry steps were opened from the board in this tab, so saving goes back to the board in the browser's
// history too (a reload in the middle doesn't know, and replaces the address instead)
let stepsFromBoard = 0;

// One of the table's two matches: played (finished), being played (ongoing with id), or the next one (ongoing
// without id; its first hand starts it). null: a match that can't be played yet.
function matchSlot(pad: TablePad, n: number): PadMatch | null {
  const found = pad.matches.find((m) => m.number === n);
  if (found) return found;
  const next = pad.matches.filter((m) => m.kind === "finished").length + 1;
  if (pad.done || n !== next || pad.matches.some((m) => m.kind === "ongoing")) return null;
  return {kind: "ongoing", id: 0, number: n, score1: 0, score2: 0, threshold: THRESHOLD, winner: null, hands: []};
}

// The table's scorepad on the admin's phone (Mobilni ekrani 14s–14ab, admin-mobile 23–29), at the address of the
// desktop's scorepad. A tap on a table in the round opens it straight on its board, as the players' scoreboard plus:
// Meč 1 · Meč 2 (a finished match too), a tap on a hand to correct it on the keypad, as Custom or to delete it, Custom
// for a new hand typed freely (then "s ovim dosta" is asked), and Tko igra. A table nobody has started yet asks Tko
// igra first.
//   (none) | ?mec=N   the board of the current match, or of match N
//   &igra=new|ID&korak=1  entering or correcting a hand on the players' keypad
//   ?kraj=1           Kraj kola, after the second match is finished
// Every change goes through the admin's calls (the server recounts the standings and the ratings), so finished
// matches can be corrected too.
export default function TablePhone() {
  const params = useParams<{leagueId: string; roundId: string}>();
  const leagueId = Number(params.leagueId);
  const roundId = Number(params.roundId);
  const router = useTransitionRouter();
  const search = useSearchParams();
  const mec = Number(search.get("mec")) || null;
  const igra = search.get("igra");
  const korak = (search.get("korak") as Step | null) ?? null;
  const kraj = search.get("kraj") === "1";

  const [pad, setPad] = useState<TablePad | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPad(await getTablePadAPI(roundId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Stol se nije učitao.");
    }
  }, [roundId]);

  useEffect(() => {
    load();
    // back from Tko igra (confirmed there): the board again, with what changed
    window.addEventListener("popstate", load);
    return () => window.removeEventListener("popstate", load);
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

  // a table nobody has started: who plays first, as players do on Započni igru (the ratings need it)
  const needsLineup = pad != null && !pad.done && !pad.bye && !pad.hasLineup;
  const lineupHref = `/round/lineup/${roundId}?league=${leagueId}`;
  useEffect(() => {
    if (needsLineup) router.replace(lineupHref);
  }, [needsLineup, router, lineupHref]);

  if (loadError && !pad) {
    return (
      <Screen>
        <ErrorState title="Stol se nije učitao" onRetry={load} />
      </Screen>
    );
  }
  if (!pad || needsLineup) {
    return (
      <Screen fill>
        <CenteredSpinner />
      </Screen>
    );
  }
  const base = `/league/${leagueId}/daily-standings/table/${roundId}`;
  const roundHref = `/league/${leagueId}/daily-standings${pad.date ? `?date=${pad.date}${pad.roundNumber ? `&round=${pad.roundNumber}` : ""}` : ""}`;
  // back to the round the table was opened from (or, opened directly, to that night's round)
  const toRound = () => (window.history.length > 1 ? router.back() : router.push(roundHref, "back"));
  if (kraj) return <RoundEnd pad={pad} onBack={() => router.replace(base, "back")} />;
  if (pad.bye) {
    return (
      <Screen>
        <BoardTop pad={pad} onBack={toRound} />
        <EmptyState>Za ovim stolom je slobodna runda, nema igara.</EmptyState>
      </Screen>
    );
  }
  const number = mec ?? currentMatchNumber(pad.matches);
  return (
    <MatchPhone
      key={number}
      pad={pad}
      base={base}
      number={number}
      igra={igra}
      korak={korak}
      reload={load}
      onBack={toRound}
      onLineup={() => router.push(`${lineupHref}&from=pad`)}
    />
  );
}

// The board's top row: ‹ back to the round, the table with the admin's shield, and Tko igra
function BoardTop({pad, onBack, onLineup}: {pad: TablePad; onBack: () => void; onLineup?: () => void}) {
  const label = [`Stol ${pad.table ?? "–"}`, pad.roundNumber && `Kolo ${pad.roundNumber}`].filter(Boolean).join(" · ");
  return (
    <Box sx={{flex: "none", height: 44, display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 44px", alignItems: "center", gap: "6px", mx: "-6px"}}>
      <IconCircleButton label={pad.roundNumber ? `Natrag na kolo ${pad.roundNumber}` : "Natrag"} size={44} onClick={onBack} sx={{"& svg": {fontSize: 26}}}>
        <ChevronLeftRoundedIcon />
      </IconCircleButton>
      <Eyebrow sx={{minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", "& svg": {flex: "none", fontSize: 17, color: color.navy}}}>
        <AdminPanelSettingsRoundedIcon titleAccess="Admin" />
        <Box component="span" sx={ellipsis}>
          {label}
        </Box>
      </Eyebrow>
      {onLineup ? (
        <IconCircleButton label="Tko igra" size={44} onClick={onLineup} sx={{"& svg": {fontSize: 22}}}>
          <GroupRoundedIcon />
        </IconCircleButton>
      ) : (
        <span />
      )}
    </Box>
  );
}

// A match's board and the hand entry over it, with the hand being entered in local state
function MatchPhone({
  pad,
  base,
  number,
  igra,
  korak,
  reload,
  onBack,
  onLineup,
}: {
  pad: TablePad;
  base: string;
  number: number;
  igra: string | null;
  korak: Step | null;
  reload: () => Promise<void>;
  onBack: () => void;
  onLineup: () => void;
}) {
  const router = useTransitionRouter();
  const match = matchSlot(pad, number);
  const names: [string, string] = [pad.team1.name, pad.team2.name];
  const [entry, setEntry] = useState<EntryState>(blankEntry());
  // which hand the entry holds ("new" or its id); null: none yet
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  // the sheets over the board: a hand tapped (and its delete confirmation), Custom for a new or a saved hand
  const [handSheet, setHandSheet] = useState<PadHand | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [manual, setManual] = useState<{hand: PadHand | null; a: string; b: string} | null>(null);
  // after a custom hand: ask about "s ovim dosta" on the match's last hand (null: the hand just added)
  const [askDosta, setAskDosta] = useState<{hand: number | null} | null>(null);
  const [dostaError, setDostaError] = useState<string | null>(null);

  const editingId = igra && igra !== "new" ? Number(igra) : null;
  const editing = editingId != null ? match?.hands.find((h) => h.id === editingId) ?? null : null;

  // the hand opened (or a reload in the middle of entering it): the entry starts from it, or empty. A custom hand
  // corrected on the keypad becomes a normal one: it starts afresh.
  useEffect(() => {
    if (!igra || igra === entryFor) return;
    if (igra === "new") setEntry(blankEntry());
    else if (editing) setEntry(editing.custom ? blankEntry() : fromPadHand(editing));
    else return;
    setEntryFor(igra);
    setError(null);
  }, [igra, entryFor, editing]);

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
        <BoardTop pad={pad} onBack={() => router.replace(base, "back")} />
        <EmptyState>Ovaj meč još ne može početi.</EmptyState>
      </Screen>
    );
  }

  const target: HandTarget = match.kind === "finished" ? {kind: "finished", matchId: match.id} : {kind: "ongoing"};
  // a change from the board's sheets: they close once it is saved, and stay open with the error when it isn't
  const runSheet = async (action: () => Promise<unknown>, fallback: string, after?: () => void) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      await reload();
      setHandSheet(null);
      setAskDelete(false);
      setManual(null);
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallback);
    }
    setSaving(false);
  };

  // ---------- the steps ----------
  if (korak && igra && entryFor === igra) {
    const save = async () => {
      if (!canSave(entry) || saving) return;
      setSaving(true);
      setError(null);
      try {
        const hand = toAdminHand(entry);
        await (editing ? updateHandAPI(match.kind, editing.id, hand) : addHandAPI(pad.roundId, target, hand));
        await reload();
        setSaving(false);
        toBoard();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Igra nije spremljena.");
        setSaving(false);
      }
    };
    const handNumber = editing ? match.hands.findIndex((h) => h.id === editing.id) + 1 : match.hands.length + 1;
    const wizard = (children: React.ReactNode) => (
      <Screen fill gap={0} sx={{pt: "calc(22px + env(safe-area-inset-top))"}}>
        {children}
        {error && <ErrorNote sx={{mb: "10px"}}>{error}</ErrorNote>}
      </Screen>
    );
    const active: 0 | 1 = entry.active === 2 ? 1 : 0;
    return wizard(
      <>
        <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "12px", pb: "12px", flex: "none"}}>
          <Eyebrow sx={{px: "4px"}}>{editing ? `Igra ${handNumber} · ispravak` : `Igra ${handNumber}`}</Eyebrow>
          <TeamValueBoxes names={names} label="Igra" values={entry.points} active={active} onPick={(i) => setEntry((s) => setActive(s, i === 1 ? 2 : 1))} />
        </Box>
        <PointsKeypad onDigit={(d) => setEntry((s) => typeDigit(s, d))} onClear={() => setEntry((s) => clearPoints(s))} />
        <ActionPair onBack={stepBack} nextLabel="Spremi" onNext={save} nextDisabled={!canSave(entry)} nextLoading={saving} />
      </>
    );
  }

  // ---------- the board ----------
  const wins = roundWins(pad.matches);
  const slots = matchSlots(pad.matches);
  // Meč 1 · Meč 2 once the second match is there (or the round is over)
  const showTabs = pad.done || pad.matches.some((m) => m.kind === "finished");
  const viewDone = match.kind === "finished";
  const finishable = match.kind === "ongoing" && match.id !== 0 && match.winner != null;
  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      await finishTableMatchAPI(pad.roundId);
      await reload();
      // after the second match: Kraj kola; after the first: the next match's board
      router.replace(number >= TABLE_MATCHES ? `${base}?kraj=1` : `${base}?mec=${number + 1}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Meč nije završen.");
    }
    setFinishing(false);
  };
  const handIndex = (h: PadHand) => match.hands.findIndex((x) => x.id === h.id) + 1;
  const openSheet = (id: number) => {
    const h = match.hands.find((x) => x.id === id);
    if (!h) return;
    setError(null);
    setAskDelete(false);
    setHandSheet(h);
  };
  const fields = manual ? manualFields(manual.a, manual.b) : null;
  const saveManual = () => {
    if (!manual || !fields?.points || saving) return;
    const hand = {custom: true as const, points1: fields.points[0], points2: fields.points[1]};
    const editedId = manual.hand?.id ?? null;
    runSheet(() => (manual.hand ? updateHandAPI(match.kind, manual.hand.id, hand) : addHandAPI(pad.roundId, target, hand)), "Igra nije spremljena.", () => setAskDosta({hand: editedId}));
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
  const sub = `Meč ${number}${viewDone ? " · završen" : ""}`;

  return (
    <Screen fill gap={0} sx={{pt: "calc(14px + env(safe-area-inset-top))"}}>
      <Box sx={{flex: "none", display: "flex", flexDirection: "column", gap: "12px"}}>
        <BoardTop pad={pad} onBack={onBack} onLineup={onLineup} />
        <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px"}}>
          {([0, 1] as const).map((i) => (
            <ScorePanel key={i} index={i} name={names[i]} wins={wins[i]} total={i ? match.score2 : match.score1} threshold={match.threshold} celebrate={match.winner === i + 1 && !viewDone} />
          ))}
        </Box>
        {showTabs && (
          <MatchTabs
            tabs={slots.map((s) => ({number: s.number, sub: matchTabSub(s, names, "admin"), live: s.state !== "done" && !pad.done}))}
            value={number}
            onChange={(n) => n !== number && router.replace(`${base}?mec=${n}`)}
          />
        )}
        {viewDone && (
          <Box sx={{display: "flex", alignItems: "flex-start", gap: "10px", p: "12px 14px", borderRadius: "16px", background: color.cream, fontSize: 14, fontWeight: 600, lineHeight: 1.4, "& svg": {flex: "none", fontSize: 20, color: color.navy}}}>
            <InfoRoundedIcon aria-hidden />
            {pad.done ? "Runda je završena. Izmjene mijenjaju rezultat i poredak." : `Meč ${number} je završen. Izmjene mijenjaju rezultat i poredak.`}
          </Box>
        )}
        {dostaTeams.length === 0 && match.threshold > THRESHOLD && <TargetFlag target={match.threshold} />}
      </Box>
      <HandList rows={match.hands.map((h) => ({id: h.id, left: h.total1, right: h.total2}))} onOpen={openSheet} sx={{mt: "14px"}} />
      {!viewDone && (
        <Box sx={{flex: "none", pt: "14px", display: "flex", flexDirection: "column", gap: "10px"}}>
          {error && !handSheet && !manual && <ErrorNote>{error}</ErrorNote>}
          <Box sx={{display: "flex", gap: "10px"}}>
            {finishable ? (
              <PrimaryButton icon={<DoneRoundedIcon />} bg={teamColor[match.winner! - 1]} onClick={finish} loading={finishing} sx={{flex: 1, minWidth: 0}}>
                Završi meč
              </PrimaryButton>
            ) : (
              <PrimaryButton icon={<AddCircleRoundedIcon />} onClick={() => step("1", "new")} sx={{flex: 1, minWidth: 0}}>
                Upiši igru
              </PrimaryButton>
            )}
            <Box
              component="button"
              type="button"
              aria-label="Custom"
              onClick={() => {
                setError(null);
                setManual({hand: null, a: "", b: ""});
              }}
              sx={{...buttonBase, flex: "none", height: 60, px: "16px", borderRadius: "18px", background: color.white, color: color.navy, boxShadow: shadow.pill, display: "flex", alignItems: "center", gap: "6px", fontSize: 16, fontWeight: 600, "& svg": {fontSize: 24}, "&:active": {transform: "scale(.97)"}}}
            >
              <EditNoteRoundedIcon aria-hidden />
              Custom
            </Box>
          </Box>
        </Box>
      )}

      {/* a hand tapped: correct it on the keypad or as Custom, or delete it */}
      <BottomSheet open={handSheet != null && !askDelete} onClose={() => setHandSheet(null)} title={handSheet ? `Igra ${handIndex(handSheet)}` : ""} eyebrow={sub} closable>
        {handSheet && (
          <>
            <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
              {([0, 1] as const).map((i) => (
                <Box key={i} sx={{minWidth: 0, borderRadius: "18px", background: color.paper2, p: "12px 14px", display: "flex", flexDirection: "column", gap: "2px", boxShadow: `inset 0 0 0 2px ${teamColor[i]}`}}>
                  <Box component="span" sx={{fontSize: 14, fontWeight: 600, color: teamColor[i], ...ellipsis}}>
                    {names[i]}
                  </Box>
                  <Box component="span" sx={{fontFamily: font.display, fontSize: 34, fontWeight: 800, lineHeight: 1.05, ...tabular}}>
                    {i ? handSheet.total2 : handSheet.total1}
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{display: "flex", flexDirection: "column", gap: "8px"}}>
              <SheetChoice
                icon={<FormatListNumberedRoundedIcon />}
                title="Ispravi igru"
                text="Bodovi jedne ekipe, ostatak do 11, kao u igri"
                onClick={() => {
                  const id = handSheet.id;
                  setHandSheet(null);
                  step("1", String(id));
                }}
              />
              <SheetChoice
                icon={<EditNoteRoundedIcon />}
                title="Custom"
                text="Bodovi svake ekipe zasebno, npr. za „s ovim dosta”"
                onClick={() => {
                  setManual({hand: handSheet, a: String(handSheet.total1), b: String(handSheet.total2)});
                  setHandSheet(null);
                }}
              />
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => {
                setError(null);
                setAskDelete(true);
              }}
              sx={{...buttonBase, height: 52, border: `1.5px solid ${tint.red[35]}`, borderRadius: "16px", background: color.white, color: color.red, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: 16, fontWeight: 600, "& svg": {fontSize: 20}}}
            >
              <DeleteRoundedIcon aria-hidden />
              Obriši igru
            </Box>
          </>
        )}
      </BottomSheet>
      <ConfirmSheet
        open={handSheet != null && askDelete}
        onClose={() => setAskDelete(false)}
        onConfirm={() => handSheet && runSheet(() => deleteHandAPI(match.kind, handSheet.id), "Igra nije obrisana.")}
        eyebrow={sub}
        title={handSheet ? `Obriši igru ${handIndex(handSheet)}?` : ""}
        text={handSheet ? `Igra ${handSheet.total1} : ${handSheet.total2} briše se iz Meča ${number}. Zbroj meča i poredak ponovno se računaju.` : ""}
        action="Obriši igru"
        icon={<DeleteRoundedIcon />}
        busy={saving}
        error={askDelete ? error : null}
      />

      {/* Custom: each team's points typed on their own, 0 to 99 */}
      <BottomSheet
        open={manual != null}
        onClose={() => setManual(null)}
        title={manual?.hand ? `Igra ${handIndex(manual.hand)} · custom` : "Custom"}
        eyebrow={manual?.hand ? sub : `${sub} · nova igra`}
        closable
        busy={saving}
      >
        {manual && fields && (
          <>
            <Box component="p" sx={{m: 0, fontSize: 14, lineHeight: 1.45, color: color.muted, textWrap: "pretty"}}>
              Upiši bodove svake ekipe, od 0 do 99. Zbroj ne mora biti 11.
            </Box>
            {error && (
              <Box role="alert" sx={{display: "flex", alignItems: "flex-start", gap: "10px", p: "12px 14px", borderRadius: "14px", background: tint.red[10], color: color.red, fontSize: 14, fontWeight: 600, lineHeight: 1.4, "& svg": {flex: "none", fontSize: 20}}}>
                <ErrorRoundedIcon aria-hidden />
                Spremanje nije uspjelo. {error}
              </Box>
            )}
            <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "10px"}}>
              {([0, 1] as const).map((i) => {
                const key = i ? "b" : "a";
                return (
                  <Box component="label" key={i} sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "6px"}}>
                    <Box component="span" sx={{fontSize: 14, fontWeight: 700, color: teamColor[i], ...ellipsis}}>
                      {names[i]}
                    </Box>
                    <Box
                      component="input"
                      value={manual[key]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setManual((m) => (m ? {...m, [key]: v} : m));
                        setError(null);
                      }}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      aria-label={`Bodovi ${names[i]}`}
                      sx={{
                        width: "100%",
                        height: 68,
                        boxSizing: "border-box",
                        borderRadius: "16px",
                        border: `2px solid ${teamColor[i]}`,
                        background: color.paper2,
                        textAlign: "center",
                        fontFamily: font.display,
                        fontSize: 36,
                        fontWeight: 800,
                        color: color.ink,
                        outline: "none",
                        ...tabular,
                        "&::placeholder": {color: color.faint},
                        "&:focus-visible": {boxShadow: shadow.focus},
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
            {fields.bad && (
              <Box sx={{fontSize: 13, fontWeight: 600, color: color.red}}>Upiši broj od 0 do 99.</Box>
            )}
            <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px"}}>
              <Box
                component="button"
                type="button"
                onClick={() => setManual(null)}
                disabled={saving}
                sx={{...buttonBase, height: 56, border: `1.5px solid ${color.borderControl}`, borderRadius: "16px", background: color.white, color: color.navy, fontSize: 16, fontWeight: 600}}
              >
                Odustani
              </Box>
              <PrimaryButton onClick={saveManual} disabled={!fields.points} loading={saving} height={56} sx={{borderRadius: "16px", fontSize: 16, boxShadow: "none"}}>
                {manual.hand ? "Spremi ispravak" : "Spremi igru"}
              </PrimaryButton>
            </Box>
          </>
        )}
      </BottomSheet>
      <DostaPrompt teams={dostaTeams} onPick={pickDosta} onSkip={skipDosta} busy={saving} error={dostaError} />
    </Screen>
  );
}

// A choice in the hand's sheet: an icon in a white circle, what it does and how, and a chevron
function SheetChoice({icon, title, text, onClick}: {icon: React.ReactNode; title: string; text: string; onClick: () => void}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{...buttonBase, width: "100%", minHeight: 64, display: "flex", alignItems: "center", gap: "14px", p: "10px 14px", borderRadius: "18px", background: color.paper, textAlign: "left", color: color.ink, "&:active": {background: color.lineFill}}}
    >
      <Box component="span" aria-hidden sx={{width: 40, height: 40, flex: "none", borderRadius: "50%", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 22}}}>
        {icon}
      </Box>
      <Box component="span" sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
        <Box component="span" sx={{fontSize: 16, fontWeight: 700}}>
          {title}
        </Box>
        <Box component="span" sx={{fontSize: 13, color: color.muted}}>
          {text}
        </Box>
      </Box>
      <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 22, color: color.navy}} />
    </Box>
  );
}

// Kraj kola (29): the round's wins and the matches, then back to the table
function RoundEnd({pad, onBack}: {pad: TablePad; onBack: () => void}) {
  return (
    <Screen>
      <ScreenTitle eyebrow="Pobjede u kolu" title="Kraj kola" size={40} sx={{pb: "8px"}} />
      <RoundResultCards
        names={[pad.team1.name, pad.team2.name]}
        wins={roundWins(pad.matches)}
        matches={pad.matches.filter((m) => m.kind === "finished").map((m) => ({id: m.id, left: m.score1, right: m.score2}))}
      />
      <PrimaryButton icon={<ChevronLeftRoundedIcon />} onClick={onBack} sx={{mt: "auto"}}>
        Natrag na stol
      </PrimaryButton>
    </Screen>
  );
}
