"use client";

import {createMatchAPI, MatchAlreadyFinishedError} from "@/app/_fetchers/match/create";
import {getOngoingMatchAPI, OngoingMatchGoneError} from "@/app/_fetchers/ongoingMatch/getOne";
import {getRoundDataAPI} from "@/app/_fetchers/round/getOne";
import useCountUp from "@/app/_hooks/useCountUp";
import useIsDesktop from "@/app/_hooks/useIsDesktop";
import {MATCH_THRESHOLD, matchWinner} from "@/app/_lib/game/scoring";
import useRoundStore from "@/app/_store/RoundStore";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import {color, teamColor} from "@/app/_styles/tokens";
import {buttonBase, CenteredSpinner, DesktopShell, ErrorNote, Eyebrow, PrimaryButton, Screen} from "@/app/_ui/sp";
import {currentRoundPath} from "@/app/ongoing-match/ui/currentRoundPath";
import {HandList, HandRow, ScorePanel} from "@/app/ongoing-match/ui/BoardParts";
import HandEntryPanel from "@/app/ongoing-match/ui/HandEntryPanel";
import {markEntryOpened, openHandForEdit, previousTotals, rememberTotals, startNewHand, takeHandMark} from "@/app/ongoing-match/ui/handFlow";
import useMatchSides from "@/app/ongoing-match/ui/useMatchSides";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import DoneRoundedIcon from "@mui/icons-material/DoneRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import {Box} from "@mui/material";
import {useParams, usePathname} from "next/navigation";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";

// pips that should pop on the next match after "Završi meč"
const pipPops = new Map<number, number>();

export default function ScoreBoardPage() {
  const params = useParams<{matchId: string}>();
  const matchId = Number(params.matchId);
  const router = useTransitionRouter();
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const setOngoingMatch = useOngoingMatchStore((s) => s.setOngoingMatch);
  const match = useOngoingMatchStore((s) => s.ongoingMatch);
  const setRoundData = useRoundStore((s) => s.setRoundData);
  const sides = useMatchSides();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mark, setMark] = useState<ReturnType<typeof takeHandMark>>(null);
  const [popPip] = useState(() => {
    const p = pipPops.get(matchId);
    pipPops.delete(matchId);
    return p;
  });
  const [startFrom] = useState(() => previousTotals(matchId));
  const listRef = useRef<HTMLDivElement | null>(null);

  // The match was finished, e.g. on a teammate's phone: go to the next match or the round result
  const followFinishedMatch = useCallback(async () => {
    const roundId = useRoundStore.getState().roundData?.id;
    router.replace(roundId ? await currentRoundPath(roundId) : "/");
  }, [router]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const m = await getOngoingMatchAPI(matchId);
      setOngoingMatch(m);
      if (m.round_id) setRoundData(await getRoundDataAPI(Number(m.round_id)));
      setMark(takeHandMark(matchId));
    } catch (error) {
      if (error instanceof OngoingMatchGoneError) {
        await followFinishedMatch();
        return;
      }
      setLoadError("Meč nije moguće učitati.");
    } finally {
      setLoading(false);
    }
  }, [matchId, setOngoingMatch, setRoundData, followFinishedMatch]);

  useEffect(() => {
    load();
  }, [load]);

  // the hand entry opens with a view transition, which waits for the route; have it ready
  useEffect(() => {
    router.router.prefetch(`/ongoing-match/${matchId}/ongoing-result/new/score`);
  }, [router, matchId]);

  // Several phones can follow the same match, so pick up hands entered elsewhere
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        setOngoingMatch(await getOngoingMatchAPI(matchId));
      } catch (error) {
        if (error instanceof OngoingMatchGoneError) await followFinishedMatch();
      }
    };
    const intervalId = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [matchId, setOngoingMatch, followFinishedMatch]);

  const p = (side: 1 | 2) => (side === 1 ? match.player_pair1_score : match.player_pair2_score) ?? 0;
  const totals: [number, number] = [p(sides.left), p(sides.right)];
  const threshold = match.score_threshold ?? MATCH_THRESHOLD;
  const winnerSide = loading ? null : matchWinner(match.player_pair1_score ?? 0, match.player_pair2_score ?? 0, threshold);
  const winner = winnerSide == null ? null : winnerSide === sides.left ? 0 : 1;

  // totals only count up when they change while watching (or right after saving a hand), not on first open
  const firstView = useRef(true);
  const animate = !loading && (startFrom != null || !firstView.current);
  const shownL = useCountUp(loading ? startFrom?.[0] ?? 0 : totals[0], animate ? 600 : 0, 200, startFrom?.[0]);
  const shownR = useCountUp(loading ? startFrom?.[1] ?? 0 : totals[1], animate ? 600 : 0, 200, startFrom?.[1]);
  useEffect(() => {
    if (!loading) firstView.current = false;
  }, [loading]);
  useEffect(() => {
    if (!loading) rememberTotals(matchId, totals);
  });

  // the celebration starts once the count-up has (nearly) arrived
  const [celebrate, setCelebrate] = useState<0 | 1 | null>(null);
  useEffect(() => {
    if (winner == null) {
      setCelebrate(null);
      return;
    }
    const t = setTimeout(() => setCelebrate(winner), 850);
    return () => clearTimeout(t);
  }, [winner]);

  const rows: HandRow[] = useMemo(
    () =>
      (match.results ?? []).map((r) => {
        const left = sides.left === 1 ? r.team1_game_points : r.team2_game_points;
        const right = sides.left === 1 ? r.team2_game_points : r.team1_game_points;
        const animate = mark?.added != null && mark.added === r.result_id ? "in" : mark?.flash === r.result_id ? "flash" : undefined;
        return {id: r.result_id, left, right, animate};
      }),
    [match.results, sides.left, mark]
  );

  // keep the newest hand in view after one is added
  useEffect(() => {
    if (mark?.added == null) return;
    const t = setTimeout(() => listRef.current?.scrollTo({top: listRef.current.scrollHeight, behavior: "smooth"}), 80);
    return () => clearTimeout(t);
  }, [mark, rows.length]);

  const finish = async () => {
    if (finishing || winner == null) return;
    setFinishing(true);
    setFinishError(null);
    try {
      const outcome = await createMatchAPI(matchId);
      useOngoingMatchStore.getState().resetOngoingMatch();
      // replace, so going back doesn't open the match that no longer exists
      if (outcome.nextOngoingMatchId) {
        pipPops.set(outcome.nextOngoingMatchId, winner);
        router.replace(`/ongoing-match/${outcome.nextOngoingMatchId}`);
      } else {
        router.replace(`/round/${outcome.roundId ?? useRoundStore.getState().roundData?.id}/result`);
      }
    } catch (error) {
      if (error instanceof MatchAlreadyFinishedError) {
        await followFinishedMatch();
        return;
      }
      setFinishError("Meč nije moguće završiti. Pokušaj ponovo.");
      setFinishing(false);
    }
  };

  const openPhone = async (resultId: number) => {
    if (opening != null) return;
    setOpening(resultId);
    try {
      await openHandForEdit(resultId);
      markEntryOpened(matchId);
      router.push(`${pathname}/ongoing-result/${resultId}/score`);
    } catch {
      setOpening(null);
    }
  };

  const openDesktop = async (resultId: number) => {
    try {
      await openHandForEdit(resultId);
      setEditingId(resultId);
    } catch {
      // keeps the current entry
    }
  };

  const newHand = () => {
    startNewHand(matchId);
    markEntryOpened(matchId);
    router.push(`${pathname}/ongoing-result/new/score`);
  };

  const panels = (size: "phone" | "desktop") =>
    ([0, 1] as const).map((i) => (
      <ScorePanel
        key={i}
        index={i}
        name={sides.names[i]}
        wins={sides.wins[i]}
        total={i === 0 ? shownL : shownR}
        finalTotal={totals[i]}
        threshold={threshold}
        celebrate={celebrate === i}
        popPip={popPip === i}
        size={size}
      />
    ));

  const matchLabel = `Meč ${Math.min(sides.matchNumber, 2)} od 2`;
  const finishButton = winner != null && (
    <PrimaryButton icon={<DoneRoundedIcon />} bg={teamColor[winner]} onClick={finish} loading={finishing}>
      Završi meč
    </PrimaryButton>
  );

  // the phone board's root shares its view-transition-name with the Start Game card, which grows into it
  const boardSx = {viewTransitionName: "table", background: color.paper};

  if (loading)
    return isDesktop ? (
      <DesktopShell active="game" title="Meč">
        <CenteredSpinner />
      </DesktopShell>
    ) : (
      <Screen fill sx={boardSx}>
        <CenteredSpinner />
      </Screen>
    );

  if (loadError) {
    const body = <ErrorNote onRetry={load}>{loadError}</ErrorNote>;
    return isDesktop ? <DesktopShell active="game" title="Meč">{body}</DesktopShell> : <Screen>{body}</Screen>;
  }

  if (isDesktop) {
    const editIndex = editingId != null ? rows.findIndex((r) => r.id === editingId) + 1 : rows.length + 1;
    return (
      <DesktopShell
        active="game"
        eyebrow={matchLabel}
        title={`${sides.names[0]} vs ${sides.names[1]}`}
        right={
          sides.tableNumber != null && (
            <Box
              sx={{display: "flex", alignItems: "center", gap: "10px", height: 44, px: "16px", borderRadius: "22px", background: color.card, fontSize: 15, fontWeight: 600, boxShadow: "0 1px 3px rgba(31,36,51,.06)"}}
            >
              <TableRestaurantRoundedIcon sx={{fontSize: 20, color: color.navy}} />
              Stol {sides.tableNumber}
              {sides.roundNumber != null && ` · Round ${sides.roundNumber}`}
            </Box>
          )
        }
      >
        <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) 460px", gap: "20px"}}>
          <Box sx={{minHeight: 0, display: "flex", flexDirection: "column", gap: "14px"}}>
            <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "14px"}}>{panels("desktop")}</Box>
            <HandList rows={rows} onOpen={openDesktop} selectedId={editingId} size="desktop" listRef={listRef} />
          </Box>
          {winner != null && editingId == null ? (
            <Box sx={{display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "12px"}}>
              <Box sx={{p: "20px", borderRadius: "24px", background: color.card, display: "flex", flexDirection: "column", gap: "8px"}}>
                <Eyebrow>Kraj meča</Eyebrow>
                <Box sx={{fontSize: 17, fontWeight: 600}}>
                  Pobjednik meča: {sides.names[winner]}. Klikni na igru za ispravak ili završi meč.
                </Box>
              </Box>
              {finishError && <ErrorNote>{finishError}</ErrorNote>}
              {finishButton}
            </Box>
          ) : (
            <HandEntryPanel
              matchId={matchId}
              sides={sides.sides}
              names={sides.names}
              handNumber={editIndex}
              editingId={editingId}
              onSaved={() => {
                setEditingId(null);
                load();
              }}
              onCancelEdit={() => setEditingId(null)}
            />
          )}
        </Box>
      </DesktopShell>
    );
  }

  return (
    <Screen fill gap={0} sx={{...boardSx, pt: "calc(14px + env(safe-area-inset-top))"}}>
      <Box sx={{display: "flex", flexDirection: "column", gap: "12px", animation: "spFadeUp 320ms 120ms both"}}>
        <Box sx={{position: "relative", height: 44, display: "flex", alignItems: "center", justifyContent: "center"}}>
          <Box
            component="button"
            type="button"
            onClick={() => router.push("/", "back")}
            aria-label="Početni zaslon"
            sx={{
              ...buttonBase,
              position: "absolute",
              left: "-6px",
              top: 0,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: color.card,
              color: color.navy,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(31,36,51,.1)",
              "&:active": {transform: "scale(.94)"},
              "& svg": {fontSize: 24},
            }}
          >
            <HomeRoundedIcon />
          </Box>
          <Eyebrow>{matchLabel}</Eyebrow>
        </Box>
        <Box sx={{display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px"}}>{panels("phone")}</Box>
      </Box>
      <HandList rows={rows} onOpen={openPhone} listRef={listRef} sx={{mt: "14px"}} />
      <Box sx={{pt: "14px", display: "flex", flexDirection: "column", gap: "10px"}}>
        {finishError && <ErrorNote>{finishError}</ErrorNote>}
        {finishButton || (
          <PrimaryButton icon={<AddCircleRoundedIcon />} onClick={newHand} loading={opening != null}>
            Upiši igru
          </PrimaryButton>
        )}
      </Box>
    </Screen>
  );
}
