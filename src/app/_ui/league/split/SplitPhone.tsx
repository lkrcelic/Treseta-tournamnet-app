"use client";

import useLeagueNights from "@/app/_hooks/useLeagueNights";
import useLeagues from "@/app/_hooks/useLeagues";
import useNavStack from "@/app/_hooks/useNavStack";
import useNightSplit from "@/app/_hooks/useNightSplit";
import {SplitTeam} from "@/app/_interfaces/split";
import {leagueNightString} from "@/app/_lib/dates";
import {Slot, SLOTS} from "@/app/_lib/locations";
import {nextNightIndex, nightLabel} from "@/app/_lib/nights";
import {matchesQuery} from "@/app/_lib/ui/text";
import {useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, EmptyState, ErrorNote, LoadingRows, OutlineButton, Screen, SearchInput, TopBar} from "@/app/_ui/sp";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import {Box} from "@mui/material";
import React, {useEffect, useState} from "react";
import {columnTitleSx, DragGhost, dropZone, DropTarget, EmptyPlace, MoveMenu, placeCounts, SplitWarnings, TeamCard, UnassignedCount, useDots, useSplitActions, useTeamDrag} from "./SplitParts";

// Podjela ekipa on the admin's phone (?view=split, Claude Design 05 A): the next night's Neraspoređene on top, then a
// switch between its two places and the place's teams. A team is dragged by its handle onto a place (or the other
// place's switch), or moved with the arrow at its end ("… idu na"). The buttons and the rules are the computer's.
export default function SplitPhone({leagueId}: {leagueId: number}) {
  const nav = useNavStack("Podjela ekipa", "/");
  const router = useTransitionRouter();
  const leagues = useLeagues(leagueId);
  const league = leagues.find((l) => l.id === leagueId);
  const {nights, error: nightsError, reload: reloadNights} = useLeagueNights(leagueId);
  const list = nights ?? [];
  const night = list[nextNightIndex(list.map((n) => n.date), leagueNightString())] ?? null;
  const open = night != null && night.second_location != null;
  const data = useNightSplit(leagueId, open ? night.date : null);

  const eyebrow = `${league?.name ?? "Liga"}${night ? ` · ${nightLabel(night.date)}` : ""}`;
  let body: React.ReactNode;
  if (nightsError && !nights) body = <ErrorNote onRetry={reloadNights}>{nightsError}</ErrorNote>;
  else if (!nights) body = <LoadingRows rows={6} height={46} />;
  else if (!night) body = <EmptyState>Liga nema nadolazećih večeri.</EmptyState>;
  else if (!open)
    body = (
      <>
        <EmptyState>Sljedeća večer ima jednu lokaciju, pa nema podjele ekipa. Drugu lokaciju dodaješ u Datumima, u Uredi večer.</EmptyState>
        <OutlineButton height={50} onClick={() => router.push(`/league/${leagueId}/manage?view=dates`)} sx={{fontSize: 15, borderWidth: "1.5px", borderColor: color.borderControl}}>
          <CalendarMonthRoundedIcon aria-hidden sx={{fontSize: 20}} />
          Datumi
        </OutlineButton>
      </>
    );
  else body = <SplitPhoneBody data={data} />;

  return (
    <Screen gap={12}>
      <TopBar onBack={nav.back} eyebrow={eyebrow} title="Podjela ekipa" />
      {body}
    </Screen>
  );
}

function SplitPhoneBody({data}: {data: ReturnType<typeof useNightSplit>}) {
  const {split, error, reload, move, saveError, warnings, dismissWarnings, unassigned} = data;
  const dot = useDots(split);
  const actions = useSplitActions(split, move);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [place, setPlace] = useState<Slot>(1);
  const [menu, setMenu] = useState<{team: SplitTeam; anchor: HTMLElement} | null>(null);
  const to = (team: SplitTeam, slot: Slot | null) => void move([{team_id: team.team_id, slot}]);
  const drag = useTeamDrag((team, target) => to(team, target === 0 ? null : target));
  // dragging over the other place's switch shows that place
  const over = drag.drag?.over ?? null;
  useEffect(() => {
    if (over === 1 || over === 2) setPlace(over);
  }, [over]);

  if (error && !split) return <ErrorNote onRetry={reload}>{error}</ErrorNote>;
  if (!split) return <LoadingRows rows={6} height={46} />;
  const places = split.places;
  if (!places) return <EmptyState>Ova večer ima jednu lokaciju, pa nema podjele ekipa.</EmptyState>;

  const shown = split.teams.filter((t) => matchesQuery(t.name, query));
  const waiting = shown.filter((t) => t.slot == null && t.active);
  const inactive = shown.filter((t) => t.slot == null && !t.active);
  const inactiveAll = split.teams.filter((t) => t.slot == null && !t.active).length;
  const counts = placeCounts(split);
  const here = shown.filter((t) => t.slot === place);
  const where = (t: SplitTeam) => (t.slot ? places[t.slot - 1].name : "neraspoređena");
  const card = (t: SplitTeam) => (
    <TeamCard key={t.team_id} team={t} dot={dot(t)} drag={drag} where={where(t)} moveButton height={42} onOpen={(anchor) => setMenu({team: t, anchor})} />
  );
  const isOver = (target: DropTarget) => drag.drag != null && over === target && drag.drag.from !== target;
  const inactiveOpen = showInactive || query.trim() !== "";
  const buttonSx = {height: 40, px: "12px", borderRadius: "13px", fontSize: 13, borderWidth: "1.5px", borderColor: color.borderControl, background: color.white, "& svg": {fontSize: 17}} as const;

  return (
    <>
      <Box sx={{display: "flex", gap: "8px"}}>
        <OutlineButton height={40} onClick={actions.byConference} disabled={!actions.canByConference} sx={{...buttonSx, flex: 1, px: "8px"}}>
          <AutoAwesomeRoundedIcon aria-hidden />
          Po konferencijama
        </OutlineButton>
        <OutlineButton height={40} onClick={actions.swap} disabled={!actions.canSwap} sx={buttonSx}>
          <SwapHorizRoundedIcon aria-hidden />
          Zamijeni
        </OutlineButton>
        <OutlineButton height={40} onClick={actions.copy} aria-label={actions.copied ? "Kopirano" : "Kopiraj raspored"} title="Kopiraj raspored" sx={{...buttonSx, width: 40, px: 0, flex: "none", "& svg": {fontSize: 18}}}>
          {actions.copied ? <CheckRoundedIcon aria-hidden /> : <ContentCopyRoundedIcon aria-hidden />}
        </OutlineButton>
      </Box>
      <SplitWarnings warnings={warnings} onClose={dismissWarnings} />
      {saveError && <ErrorNote>{saveError}</ErrorNote>}

      <Box
        component="section"
        aria-label="Neraspoređene"
        {...dropZone(0)}
        sx={{display: "flex", flexDirection: "column", gap: "8px", borderRadius: "18px", m: "-6px", p: "6px", boxShadow: isOver(0) ? `inset 0 0 0 2px ${color.navy}` : "none"}}
      >
        <Box sx={{display: "flex", alignItems: "center", gap: "8px", px: "4px"}}>
          <Box component="h2" sx={{m: 0, flex: 1, ...columnTitleSx, fontSize: 16}}>
            Neraspoređene
          </Box>
          <UnassignedCount n={unassigned} />
        </Box>
        <SearchInput height={42} variant="paper" placeholder="Traži ekipu" aria-label="Traži ekipu" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
        <Box sx={{maxHeight: 282, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", p: "2px"}}>
          {waiting.map(card)}
          {waiting.length === 0 && (
            <Box sx={{p: "6px 4px", fontSize: 13.5, color: color.muted}}>{query.trim() ? "Nijedna ekipa bez lokacije ne odgovara." : "Sve aktivne ekipe imaju lokaciju."}</Box>
          )}
        </Box>
        {inactiveAll > 0 && (
          <>
            <Box
              component="button"
              type="button"
              aria-expanded={inactiveOpen}
              onClick={() => setShowInactive((s) => !s)}
              sx={{...buttonBase, display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 36, px: "4px", fontSize: 13.5, fontWeight: 700, color: color.ink2, "& svg": {fontSize: 22, transition: "transform 150ms ease", transform: inactiveOpen ? "rotate(180deg)" : "none"}}}
            >
              Neaktivne · {inactiveAll}
              <ExpandMoreRoundedIcon aria-hidden />
            </Box>
            {inactiveOpen && <Box sx={{display: "flex", flexDirection: "column", gap: "6px", p: "2px"}}>{inactive.map(card)}</Box>}
          </>
        )}
      </Box>

      <Box role="tablist" aria-label="Lokacija" sx={{mt: "4px", display: "flex", gap: "2px", p: "4px", borderRadius: "14px", background: color.lineFill}}>
        {SLOTS.map((slot) => {
          const on = slot === place;
          return (
            <Box
              key={slot}
              component="button"
              type="button"
              role="tab"
              aria-selected={on}
              {...dropZone(slot)}
              onClick={() => setPlace(slot)}
              sx={{
                ...buttonBase,
                flex: 1,
                minWidth: 0,
                height: 40,
                borderRadius: "11px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                px: "8px",
                fontSize: 14.5,
                fontWeight: 700,
                background: on ? color.white : "transparent",
                color: on ? color.ink : color.ink2,
                boxShadow: isOver(slot) ? `inset 0 0 0 2px ${color.navy}` : on ? shadow.segment : "none",
                "& svg": {fontSize: 16, flex: "none"},
              }}
            >
              <PlaceRoundedIcon aria-hidden />
              <Box component="span" sx={{minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                {places[slot - 1].name}
              </Box>
              <Box component="span" sx={{flex: "none"}}>· {counts[slot - 1]}</Box>
            </Box>
          );
        })}
      </Box>
      {places[place - 1].address && <Box sx={{mt: "-4px", px: "4px", fontSize: 12.5, color: color.muted}}>{places[place - 1].address}</Box>}
      <Box
        role="tabpanel"
        aria-label={places[place - 1].name}
        {...dropZone(place)}
        sx={{
          minHeight: 120,
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          p: "8px",
          borderRadius: "18px",
          background: tint.navy[4],
          boxShadow: isOver(place) ? `inset 0 0 0 2px ${color.navy}` : `inset 0 0 0 2px ${tint.navy[12]}`,
        }}
      >
        {here.length ? here.map(card) : counts[place - 1] ? <Box sx={{p: "10px", fontSize: 13.5, color: color.muted}}>Nijedna ekipa ne odgovara.</Box> : <EmptyPlace />}
      </Box>

      <MoveMenu
        team={menu?.team ?? null}
        anchor={menu?.anchor ?? null}
        places={places}
        counts={counts}
        onPick={(team, slot) => {
          setMenu(null);
          to(team, slot);
        }}
        onClose={() => setMenu(null)}
      />
      <DragGhost drag={drag.drag} dot={dot} />
    </>
  );
}
