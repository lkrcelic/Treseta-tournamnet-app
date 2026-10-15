"use client";

import {getTableOverviewAPI, TableNotFoundError} from "@/app/_fetchers/round/overview";
import {TableOverview} from "@/app/_interfaces/adminHand";
import useMyTeams from "@/app/_hooks/useMyTeams";
import useNavStack from "@/app/_hooks/useNavStack";
import useOpenTable from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {nightLabel} from "@/app/_lib/nights";
import {currentMatchNumber, matchSlots, matchTabSub, roundWins, tableState, TableState} from "@/app/_lib/tableOverview";
import {color, tint} from "@/app/_styles/tokens";
import {Display, LiveDot, MessageState, Screen, StackTopBar, tabular} from "@/app/_ui/sp";
import {SmokingMark} from "@/app/_ui/smoking/SmokingParts";
import {HandList, MatchTabs, ScorePanel} from "@/app/ongoing-match/ui/BoardParts";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import TableRestaurantRoundedIcon from "@mui/icons-material/TableRestaurantRounded";
import {Box} from "@mui/material";
import {useParams} from "next/navigation";
import React, {useCallback, useEffect, useState} from "react";

const REFRESH_MS = 15000;

const CHIP: Record<TableState, {label: string; bg: string; ink: string}> = {
  live: {label: "Uživo", bg: tint.red[12], ink: color.red},
  done: {label: "Završeno", bg: tint.green[12], ink: color.green},
  new: {label: "Nije počelo", bg: color.lineFill, ink: color.ink2},
};

// Pregled stola (Mobilni ekrani 14h–14n): a table of the night read-only, for anyone signed in who doesn't edit it.
// It looks like the players' scoreboard without anything to enter: both teams with their wins in the round (a name
// opens the team, the viewer's own team is marked), Meč 1 · Meč 2, and the chosen match's hands. A live table
// refreshes itself. The player whose own table it is, still to be played, goes straight into the game instead.
export default function TablePreview() {
  const params = useParams<{leagueId: string; roundId: string}>();
  const leagueId = Number(params.leagueId);
  const roundId = Number(params.roundId);
  const {teams: myTeams} = useMyTeams();
  const {table: openTable} = useOpenTable();
  const game = useStartGame({replace: true});

  const [table, setTable] = useState<TableOverview | null>(null);
  const [failed, setFailed] = useState<"error" | "missing" | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setTable(await getTableOverviewAPI(roundId));
      setFailed(null);
      setLoadedAt(Date.now());
    } catch (e) {
      setFailed(e instanceof TableNotFoundError ? "missing" : "error");
    }
  }, [roundId]);
  useEffect(() => {
    load();
  }, [load]);

  const state = table ? tableState(table) : null;
  // a live table comes in again every 15 s and when the app is back in front
  useEffect(() => {
    if (state !== "live") return;
    const t = window.setInterval(load, REFRESH_MS);
    const onShow = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [state, load]);

  // the viewer's own table still to be played (a shared link): the game, as from Početna
  const own = openTable != null && openTable.roundId === roundId && state !== "done";
  const {start} = game;
  useEffect(() => {
    if (own) start();
  }, [own, start]);

  // the team page opened from here says "‹ Stol 4" on its back pill
  const nav = useNavStack(table ? `Stol ${table.table ?? "–"}` : null, `/league/${leagueId}/daily-standings`);
  const roundLabel = table?.roundNumber ? `Kolo ${table.roundNumber}` : nav.previousLabel ?? "Dnevni poredak";
  const retry = () => {
    setFailed(null);
    setTable(null);
    load();
  };

  if (failed && !table) {
    return (
      <Screen fill>
        <StackTopBar eyebrow="Stol" nav={nav} />
        {failed === "missing" ? (
          <MessageState
            icon={<TableRestaurantRoundedIcon />}
            title="Stol ne postoji"
            text="Kolo je možda promijenjeno ili obrisano."
            action={{label: `Natrag na ${nav.previousLabel ?? "Dnevni poredak"}`, icon: <ChevronLeftRoundedIcon />, onClick: nav.back}}
            sx={{my: "auto"}}
          />
        ) : (
          <MessageState
            role="alert"
            icon={<CloudOffRoundedIcon />}
            title="Stol se nije učitao"
            text="Provjeri vezu i pokušaj ponovno."
            action={{label: "Pokušaj ponovno", icon: <RefreshRoundedIcon />, onClick: retry}}
            sx={{my: "auto"}}
          />
        )}
      </Screen>
    );
  }
  if (!table || !state || own) {
    return (
      <Screen fill>
        <StackTopBar eyebrow="Stol" nav={nav} />
        <PreviewSkeleton />
      </Screen>
    );
  }

  const names: [string, string] = [table.team1.name, table.team2.name];
  const mine = [table.team1.id, table.team2.id].map((id) => myTeams.some((t) => t.team_id === id));
  const slots = matchSlots(table.matches);
  const shown = picked ?? currentMatchNumber(table.matches);
  const slot = slots[shown - 1];
  const match = slot.match;
  const wins = roundWins(table.matches);
  const chip = CHIP[state];

  return (
    <Screen fill gap={12}>
      <StackTopBar eyebrow="Stol" nav={nav} />
      <Box component="header" sx={{flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px"}}>
        <Box sx={{minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box sx={{fontSize: 13, fontWeight: 600, color: color.muted}}>
            {[roundLabel, table.date && nightLabel(table.date)].filter(Boolean).join(" · ")}
          </Box>
          <Box sx={{display: "flex", alignItems: "center", gap: "8px"}}>
            <Display size={30} sx={{lineHeight: 1.1}}>
              Stol {table.table ?? "–"}
            </Display>
            {table.smoking && <SmokingMark sx={{width: 30, height: 30, "& svg": {fontSize: 19}}} />}
          </Box>
        </Box>
        <Box
          component="span"
          sx={{flex: "none", height: 28, mb: "4px", px: "11px", borderRadius: "14px", display: "flex", alignItems: "center", gap: "6px", background: chip.bg, color: chip.ink, fontSize: 13, fontWeight: 700}}
        >
          {state === "live" && <LiveDot size={7} />}
          {chip.label}
        </Box>
      </Box>

      <Box sx={{flex: "none", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "12px"}}>
        {([0, 1] as const).map((i) => (
          <ScorePanel
            key={i}
            index={i}
            name={names[i]}
            wins={wins[i]}
            total={match ? (i ? match.score2 : match.score1) : 0}
            threshold={match?.threshold ?? MATCH_THRESHOLD}
            celebrate={false}
            href={`/teams/${i ? table.team2.id : table.team1.id}`}
            mine={mine[i]}
          />
        ))}
      </Box>

      <Box sx={{flex: "none"}}>
        <MatchTabs
          tabs={slots.map((s) => ({number: s.number, sub: matchTabSub(s, names, "pregled"), live: s.state === "live"}))}
          value={shown}
          onChange={setPicked}
        />
      </Box>

      <HandList
        rows={(match?.hands ?? []).map((h) => ({id: h.id, left: h.total1, right: h.total2}))}
        empty={
          <MessageState
            icon={<StyleRoundedIcon />}
            title={`Meč ${shown} još nije počeo`}
            text={state === "new" ? "Igre se pojave čim stol upiše prvu igru." : "Počinje kad se završi Meč 1."}
            onCard
            sx={{p: "48px 24px"}}
          />
        }
      />
      {state === "live" && <Refreshed at={loadedAt} />}
    </Screen>
  );
}

// "Osvježava se samo · prije 5 s" under a live table
function Refreshed({at}: {at: number}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const ago = Math.max(0, Math.round((now - at) / 1000));
  return (
    <Box sx={{flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: 13, color: color.muted, ...tabular, "& svg": {fontSize: 16}}}>
      <SyncRoundedIcon aria-hidden />
      Osvježava se samo · prije {ago} s
    </Box>
  );
}

// Pregled stola while it loads (14l): the header, both boards, the match switch and the hands as soft blocks
function PreviewSkeleton() {
  const soft = {borderRadius: "22px", background: color.paper2};
  return (
    <Box role="status" aria-label="Učitavanje" sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "12px"}}>
      <Box sx={{display: "flex", flexDirection: "column", gap: "8px", px: "4px", pt: "4px"}}>
        <Box sx={{width: 130, height: 12, borderRadius: "6px", background: color.lineFill}} />
        <Box sx={{width: 110, height: 28, borderRadius: "8px", background: color.lineFill}} />
      </Box>
      <Box sx={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px"}}>
        <Box sx={{...soft, height: 116}} />
        <Box sx={{...soft, height: 116}} />
      </Box>
      <Box sx={{height: 54, borderRadius: "16px", background: color.lineFill}} />
      <Box sx={{...soft, flex: 1}} />
    </Box>
  );
}
