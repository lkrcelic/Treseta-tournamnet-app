"use client";

import useNightSplit from "@/app/_hooks/useNightSplit";
import {SplitTeam} from "@/app/_interfaces/split";
import {Slot} from "@/app/_lib/locations";
import {nightLabel, NightLocation} from "@/app/_lib/nights";
import {matchesQuery} from "@/app/_lib/ui/text";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, Card, EmptyState, ErrorNote, LoadingRows, OutlineButton, SearchInput} from "@/app/_ui/sp";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import PlaceRoundedIcon from "@mui/icons-material/PlaceRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";
import {columnTitleSx, DragGhost, dropZone, DropTarget, EmptyPlace, MoveMenu, placeCounts, SplitWarnings, TeamCard, teamsLabel, UnassignedCount, useDots, useSplitActions, useTeamDrag} from "./SplitParts";

// Upravljanje ligom · Podjela on the computer (Claude Design 05 A): the next night's teams in three columns,
// Neraspoređene and its two places, each alphabetical. A team is dragged onto a column, or clicked for the menu that
// moves it. The inactive teams without a place are folded under Neraspoređene. Traži ekipu narrows all three columns.
export default function SplitDesktop({data}: {data: ReturnType<typeof useNightSplit>}) {
  const {split, error, reload, move, saveError, warnings, dismissWarnings, unassigned} = data;
  const dot = useDots(split);
  const actions = useSplitActions(split, move);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [menu, setMenu] = useState<{team: SplitTeam; anchor: HTMLElement} | null>(null);
  const to = (team: SplitTeam, slot: Slot | null) => void move([{team_id: team.team_id, slot}]);
  const drag = useTeamDrag((team, target) => to(team, target === 0 ? null : target));

  if (error && !split) {
    return (
      <ErrorNote onRetry={reload} sx={{alignSelf: "flex-start"}}>
        {error}
      </ErrorNote>
    );
  }
  if (!split) {
    return (
      <Card sx={{flex: 1, overflow: "hidden", borderRadius: "24px"}}>
        <LoadingRows rows={8} height={56} />
      </Card>
    );
  }
  const places = split.places;
  if (!places) return <EmptyState>Ova večer ima jednu lokaciju. Drugu dodaješ u Datumima, u Uredi večer.</EmptyState>;

  const shown = split.teams.filter((t) => matchesQuery(t.name, query));
  const waiting = shown.filter((t) => t.slot == null && t.active);
  const inactive = shown.filter((t) => t.slot == null && !t.active);
  const inactiveAll = split.teams.filter((t) => t.slot == null && !t.active).length;
  const counts = placeCounts(split);
  const where = (t: SplitTeam) => (t.slot ? places[t.slot - 1].name : "neraspoređena");
  const card = (t: SplitTeam) => <TeamCard key={t.team_id} team={t} dot={dot(t)} drag={drag} where={where(t)} onOpen={(anchor) => setMenu({team: t, anchor})} />;
  const over = (target: DropTarget) => drag.drag != null && drag.drag.over === target && drag.drag.from !== target;
  // an open search shows the inactive teams it finds
  const inactiveOpen = showInactive || query.trim() !== "";

  return (
    <Box sx={{flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "14px"}}>
      <Box sx={{flex: "none", display: "flex", alignItems: "center", gap: "12px"}}>
        <Box sx={{flex: 1, minWidth: 0}}>
          <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 22, fontWeight: 800}}>
            Podjela ekipa · {nightLabel(split.date)}
          </Box>
          <Box sx={{fontSize: 13.5, lineHeight: 1.45, color: color.ink2}}>
            Povuci ekipu na lokaciju. Promjena vrijedi odmah: igrači vide lokaciju, a Tu smo se otvara samo raspoređenima.
          </Box>
        </Box>
        <ActionButton onClick={actions.byConference} disabled={!actions.canByConference} title={actions.canByConference ? undefined : "Za to liga treba točno dvije konferencije."}>
          <AutoAwesomeRoundedIcon aria-hidden />
          Podijeli po konferencijama
        </ActionButton>
        <ActionButton onClick={actions.swap} disabled={!actions.canSwap}>
          <SwapHorizRoundedIcon aria-hidden />
          Zamijeni lokacije
        </ActionButton>
        <ActionButton onClick={actions.copy}>
          {actions.copied ? <CheckRoundedIcon aria-hidden /> : <ContentCopyRoundedIcon aria-hidden />}
          {actions.copied ? "Kopirano" : "Kopiraj raspored"}
        </ActionButton>
      </Box>
      <SplitWarnings warnings={warnings} onClose={dismissWarnings} />
      {saveError && <ErrorNote sx={{flex: "none"}}>{saveError}</ErrorNote>}

      <Box sx={{flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "300px minmax(0,1fr) minmax(0,1fr)", gap: "14px"}}>
        <Box
          component="section"
          aria-label={`Neraspoređene, ${teamsLabel(unassigned)}`}
          {...dropZone(0)}
          sx={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            borderRadius: "22px",
            overflow: "hidden",
            background: tint.navy[4],
            boxShadow: over(0) ? `inset 0 0 0 2px ${color.navy}` : `inset 0 0 0 2px ${tint.navy[12]}`,
          }}
        >
          <Box sx={{flex: "none", p: "14px 14px 10px", display: "flex", flexDirection: "column", gap: "4px"}}>
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"}}>
              <Box component="h3" sx={{m: 0, ...columnTitleSx, fontSize: 18}}>
                Neraspoređene
              </Box>
              <UnassignedCount n={unassigned} />
            </Box>
            <Box sx={{fontSize: 12.5, color: color.muted}}>Vide „Javi se adminu”, bez Tu smo.</Box>
          </Box>
          <Box sx={{flex: "none", p: "0 10px 10px"}}>
            <SearchInput height={44} variant="paper" placeholder="Traži ekipu" aria-label="Traži ekipu" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
          </Box>
          <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", p: "0 10px 10px"}}>
            {waiting.map(card)}
            {waiting.length === 0 && (
              <Box sx={{p: "10px 4px", fontSize: 13.5, color: color.muted}}>{query.trim() ? "Nijedna ekipa bez lokacije ne odgovara." : "Sve aktivne ekipe imaju lokaciju."}</Box>
            )}
          </Box>
          {inactiveAll > 0 && (
            <Box sx={{flex: "none", maxHeight: "40%", overflowY: "auto", p: "10px 14px 14px", borderTop: `1px solid ${tint.navy[8]}`, display: "flex", flexDirection: "column", gap: "8px"}}>
              <Box
                component="button"
                type="button"
                aria-expanded={inactiveOpen}
                onClick={() => setShowInactive((s) => !s)}
                sx={{...buttonBase, display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 32, fontSize: 13.5, fontWeight: 700, color: color.ink2, "& svg": {fontSize: 22, transition: "transform 150ms ease", transform: inactiveOpen ? "rotate(180deg)" : "none"}}}
              >
                Neaktivne · {inactiveAll}
                <ExpandMoreRoundedIcon aria-hidden />
              </Box>
              {inactiveOpen && inactive.map(card)}
            </Box>
          )}
        </Box>

        {places.map((place, i) => {
          const slot = (i + 1) as Slot;
          const teams = shown.filter((t) => t.slot === slot);
          return (
            <PlaceColumn key={slot} place={place} count={counts[i]} over={over(slot)} slot={slot}>
              {teams.length ? (
                <Box sx={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "6px", alignContent: "start", p: "10px"}}>{teams.map(card)}</Box>
              ) : counts[i] ? (
                <Box sx={{p: "14px", fontSize: 13.5, color: color.muted}}>Nijedna ekipa ne odgovara.</Box>
              ) : (
                <EmptyPlace />
              )}
            </PlaceColumn>
          );
        })}
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
    </Box>
  );
}

// A place's column: its name and address over its teams; navy ring while a team is dragged over it
function PlaceColumn({place, count, over, slot, children}: {place: NightLocation; count: number; over: boolean; slot: Slot; children: React.ReactNode}) {
  return (
    <Box
      component="section"
      aria-label={`${place.name}, ${teamsLabel(count)}`}
      {...dropZone(slot)}
      sx={{
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        borderRadius: "22px",
        overflow: "hidden",
        background: color.white,
        boxShadow: over ? `0 0 0 2px ${color.navy}, ${shadow.action}` : shadow.card,
        transition: "box-shadow 120ms ease",
      }}
    >
      <Box sx={{flex: "none", p: "14px 14px 10px", display: "flex", flexDirection: "column", gap: "4px", background: color.paper2, borderBottom: `1px solid ${tint.navy[7]}`}}>
        <Box sx={{display: "flex", alignItems: "center", gap: "8px"}}>
          <Box component="span" sx={{width: 30, height: 30, flex: "none", borderRadius: "10px", background: color.navy, color: color.white, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 18}}}>
            <PlaceRoundedIcon aria-hidden />
          </Box>
          <Box component="h3" sx={{m: 0, flex: 1, minWidth: 0, ...columnTitleSx, fontSize: 20, overflowWrap: "anywhere"}}>
            {place.name}
          </Box>
          <Box component="span" sx={{flex: "none", height: 24, px: "8px", borderRadius: "8px", display: "inline-flex", alignItems: "center", background: color.lineFill, color: color.navy, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"}}>
            {teamsLabel(count)}
          </Box>
        </Box>
        {place.address && <Box sx={{pl: "38px", fontSize: 12.5, color: color.muted}}>{place.address}</Box>}
      </Box>
      <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column"}}>{children}</Box>
    </Box>
  );
}

function ActionButton({children, ...rest}: React.ComponentProps<typeof OutlineButton>) {
  return (
    <OutlineButton height={42} {...rest} sx={{flex: "none", px: "14px", borderRadius: "13px", fontSize: 14, borderWidth: "1.5px", borderColor: color.borderControl, background: color.white, "& svg": {fontSize: 18}}}>
      {children}
    </OutlineButton>
  );
}
