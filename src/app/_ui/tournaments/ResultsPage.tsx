"use client";

import useNavStack from "@/app/_hooks/useNavStack";
import useOpenTable from "@/app/_hooks/useOpenTable";
import useStartGame from "@/app/_hooks/useStartGame";
import {useTournamentResults} from "@/app/_hooks/useTournaments";
import {splitPodium, standingsTeamHref, toStandingsRows} from "@/app/_lib/ui/standings";
import {TableRow, toTableRows} from "@/app/_lib/ui/tables";
import {replaceAddress} from "@/app/_lib/viewTransitions";
import useAuthStore from "@/app/_store/authStore";
import {color} from "@/app/_styles/tokens";
import {PhoneRoundTables, TableTarget} from "@/app/league/[leagueId]/daily-standings/ui/RoundTables";
import {Card, Display, EmptyState, ErrorNote, LoadingRows, PillTabs, ScrollArea, ScrollCard, StackTopBar, StandingsRows, tabPanelProps} from "@/app/_ui/sp";
import {Box} from "@mui/material";
import {useSearchParams} from "next/navigation";
import React, {useState} from "react";
import PlayerFrame from "./PlayerFrame";

// Poredak i rezultati (Claude Design "Natjecanja" G2, G3, G5; the league's Dnevni poredak pattern): the chips Poredak ·
// Kolo 1 … (the published Kolos; the one being played with the red dot), the standings with the viewer's team marked
// and a red place for a team playing now, and a Kolo's tables, the viewer's first. A table opens its Pregled stola,
// or for the player's own table still to be played the game. ?kolo= keeps the chip in the address. Public.
export default function ResultsPage({id}: {id: number}) {
  const signedIn = useAuthStore((s) => s.user != null);
  const params = useSearchParams();
  const asked = Number(params.get("kolo"));
  const [tab, setTab] = useState<number>(Number.isInteger(asked) && asked > 0 ? asked : 0);
  const [every, setEvery] = useState<number | undefined>(undefined);
  const {results: r, error, notFound, reload} = useTournamentResults(id, every);
  const nav = useNavStack(r ? (tab ? `Kolo ${tab}` : "Poredak") : null, `/turniri/${id}`);
  const {table: openTable} = useOpenTable("tournament");
  const game = useStartGame({scope: "tournament"});
  if ((r?.phase === "active" ? 30_000 : undefined) !== every) setEvery(r?.phase === "active" ? 30_000 : undefined);

  const pick = (k: number) => {
    setTab(k);
    replaceAddress(`/turniri/${id}/poredak${k ? `?kolo=${k}` : ""}`);
  };
  const kolos = (r?.kolos ?? []).filter((k) => k.published);
  const shown = tab && kolos.some((k) => k.number === tab) ? tab : 0;
  const tabs = [{key: 0, label: "Poredak"}, ...kolos.map((k) => ({key: k.number, label: `Kolo ${k.number}`, live: k.number === r?.live_kolo}))];

  const standings = toStandingsRows(r?.standings, {highlightTeamId: r?.my_team_id ?? null});
  const finished = r?.phase === "finished";
  const {podium, rest} = splitPodium(standings);
  const kolo = kolos.find((k) => k.number === shown);
  const myTeam = r?.my_team_id ?? null;
  const rows: TableRow[] = kolo
    ? toTableRows(kolo.tables)
        .map((t) => ({...t, mine: myTeam != null && (t.teamAId === myTeam || t.teamBId === myTeam)}))
        .sort((a, b) => Number(b.mine) - Number(a.mine) || a.table - b.table)
    : [];
  const target = (t: TableRow): TableTarget =>
    openTable?.roundId === t.id && !t.done ? {cue: t.started ? "Nastavi igru" : "Započni igru", onClick: game.start} : {href: `/turniri/${id}/stol/${t.id}`};

  return (
    <PlayerFrame fill>
      <StackTopBar eyebrow="Turnir" nav={nav} />
      {notFound ? (
        <Card>
          <EmptyState>Ovaj turnir ne postoji.</EmptyState>
        </Card>
      ) : error && !r ? (
        <ErrorNote onRetry={reload}>{error}</ErrorNote>
      ) : !r ? (
        <ScrollCard>
          <LoadingRows rows={8} />
        </ScrollCard>
      ) : (
        <>
          <Box component="header" sx={{display: "flex", flexDirection: "column", gap: "4px", px: "4px"}}>
            <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
              {r.name}
            </Box>
            <Display size={34} sx={{lineHeight: 1}}>
              {shown ? `Kolo ${shown}` : "Poredak"}
            </Display>
            {!shown && (
              <Box component="span" sx={{fontSize: 14, color: color.ink2}}>
                {r.phase === "upcoming" ? "Turnir još nije počeo" : finished ? "Konačni poredak" : `Nakon ${r.completed_kolos} od ${r.rounds} kola`}
              </Box>
            )}
          </Box>
          {tabs.length > 1 && <PillTabs items={tabs} value={shown} onChange={pick} label="Prikaz" idPrefix="turnir" />}
          <Box {...tabPanelProps("turnir", shown)} sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "12px"}}>
            {shown === 0 ? (
              <ScrollCard aria-label="Poredak turnira">
                {standings.length === 0 ? (
                  <EmptyState>{r.phase === "upcoming" ? "Ekipe koje potvrde dolazak bit će ovdje." : "Poredak će biti ovdje od prvog kola."}</EmptyState>
                ) : (
                  <StandingsRows rows={finished && podium.length ? rest : standings} podium={finished && podium.length ? podium : undefined} head rowHref={signedIn ? standingsTeamHref : undefined} />
                )}
              </ScrollCard>
            ) : (
              <ScrollArea bleed sx={{gap: "10px"}}>
                {game.error && <ErrorNote>{game.error}</ErrorNote>}
                <PhoneRoundTables title={`Kolo ${shown}`} rows={rows} tableTarget={signedIn ? target : undefined} teamHref={signedIn ? (tid) => `/teams/${tid}` : undefined} />
              </ScrollArea>
            )}
          </Box>
        </>
      )}
    </PlayerFrame>
  );
}
