"use client";

import {useAdminTournaments} from "@/app/_hooks/useTournaments";
import {TournamentCard} from "@/app/_interfaces/tournament";
import {capacityLabel} from "@/app/_lib/tournaments";
import {count, NOUN} from "@/app/_lib/ui/text";
import {TransitionLink, useTransitionRouter} from "@/app/_lib/viewTransitions";
import {color, font, shadow} from "@/app/_styles/tokens";
import {AdminTabBar} from "@/app/_ui/admin/AdminTabBar";
import {adminCardSx} from "@/app/_ui/admin/AdminParts";
import {ellipsis, EmptyState, ErrorNote, IconCircleButton, LoadingRows, Screen, ScrollArea, Segmented} from "@/app/_ui/sp";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";
import {DateTile, StatusChip, statusOf, tournamentMeta} from "../TournamentParts";
import {cancelledLine, ListTab, tournamentsOf} from "./TournamentsDesktop";

// The admin's Turniri on the phone (Claude Design "Turniri admin" M1, M1b): Nadolazeći · Aktivni · Završeni, a card per
// tournament (its date, meta and status), the one being played navy; + makes a new one. Under the bottom bar's Turniri.
export default function TournamentsPhone() {
  const router = useTransitionRouter();
  const {tournaments, error, reload} = useAdminTournaments();
  const all = tournaments ?? [];
  const [tab, setTab] = useState<ListTab | null>(null);
  // the day of a tournament opens on Aktivni
  const shown: ListTab = tab ?? (tournamentsOf(all, "active").length ? "active" : "upcoming");
  const list = tournamentsOf(all, shown);
  return (
    <Screen fill gap={14}>
      <Box component="header" sx={{flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", px: "4px", pt: "6px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "4px"}}>
          <Box component="span" sx={{fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: color.navy}}>
            Admin
          </Box>
          <Box component="h1" sx={{m: 0, fontFamily: font.display, fontSize: 32, fontWeight: 800, lineHeight: 1}}>
            Turniri
          </Box>
        </Box>
        <IconCircleButton label="Novi turnir" size={48} onClick={() => router.push("/turniri/novi")}>
          <AddRoundedIcon />
        </IconCircleButton>
      </Box>
      <Segmented<ListTab>
        items={[
          {key: "upcoming", label: "Nadolazeći", count: tournamentsOf(all, "upcoming").length},
          {key: "active", label: "Aktivni", count: tournamentsOf(all, "active").length},
          {key: "finished", label: "Završeni", count: tournamentsOf(all, "finished").length},
        ]}
        value={shown}
        onChange={setTab}
        label="Turniri"
        variant="track"
      />
      <ScrollArea bleed sx={{gap: "10px"}}>
        {error ? (
          <ErrorNote onRetry={reload}>{error}</ErrorNote>
        ) : !tournaments ? (
          <Box sx={{...adminCardSx, p: 0, overflow: "hidden"}}>
            <LoadingRows rows={4} height={84} />
          </Box>
        ) : list.length === 0 ? (
          <EmptyState>{shown === "upcoming" ? "Nema nadolazećih turnira. Napravi prvi s +." : shown === "active" ? "Danas se ne igra nijedan turnir." : "Još nema završenih turnira."}</EmptyState>
        ) : (
          <Box component="ul" sx={{flex: "none", listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: "10px"}}>
            {list.map((t) => (shown === "active" ? <LiveCard key={t.id} t={t} /> : <TournamentRow key={t.id} t={t} />))}
          </Box>
        )}
      </ScrollArea>
      <AdminTabBar active="turniri" />
    </Screen>
  );
}

const href = (t: TournamentCard) => `/turniri/${t.id}/upravljanje`;

function TournamentRow({t}: {t: TournamentCard}) {
  const over = t.phase === "finished" || t.phase === "cancelled";
  const cancelled = t.phase === "cancelled";
  return (
    <Box component="li">
      <Box
        component={TransitionLink}
        href={href(t)}
        sx={{
          ...adminCardSx,
          flexDirection: "row",
          alignItems: "center",
          gap: "12px",
          p: "14px",
          color: color.ink,
          textDecoration: "none",
          "&:active": {transform: "scale(.99)"},
          // Otkazan (M1c): grey, struck through, a dashed edge
          ...(cancelled && {background: color.lineFill, boxShadow: "none", border: `1.5px dashed ${color.hairline}`}),
        }}
      >
        <DateTile date={t.date} size={50} done={over} />
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px"}}>
          <Box component="span" sx={{fontSize: 17, fontWeight: 800, ...ellipsis, ...(cancelled && {color: color.muted, textDecoration: "line-through"})}}>
            {t.name}
          </Box>
          <Box component="span" sx={{fontSize: 13, color: color.ink2, ...ellipsis}}>
            {cancelled
              ? cancelledLine(t)
              : t.phase === "finished"
                ? `${count(t.rounds, NOUN.kolo)} · ${count(t.teams, NOUN.ekipa)}${t.winner ? ` · pobjednici ${t.winner.team_name}` : ""}`
                : `${tournamentMeta(t)} · ${t.max_teams != null ? `${capacityLabel(t.teams, t.max_teams)} ekipa` : count(t.teams, NOUN.ekipa)}`}
          </Box>
          <StatusChip status={statusOf(t)} height={26} sx={{fontSize: 12.5}} />
        </Box>
        <ChevronRightRoundedIcon aria-hidden sx={{flex: "none", fontSize: 26, color: color.navy}} />
      </Box>
    </Box>
  );
}

// The day before Kolo 1: Potvrda dolaska's line (the list's cards carry no arrival counts: the time is enough)
function AdminDayLine({t}: {t: TournamentCard}) {
  const closes = t.day ? new Intl.DateTimeFormat("hr-HR", {timeZone: "Europe/Zagreb", hour: "numeric", minute: "2-digit", hourCycle: "h23"}).format(new Date(t.day.closes)) : "";
  return (
    <Box component="span" sx={{fontSize: 14, color: color.cream}}>
      {t.day?.phase === "open" ? `Danas · potvrda dolaska do ${closes}` : `Danas · Kolo 1 uskoro`}
    </Box>
  );
}

// M1b: the tournament being played, navy with its Kolo
function LiveCard({t}: {t: TournamentCard}) {
  return (
    <Box component="li">
      <Box
        component={TransitionLink}
        href={`${href(t)}?view=${t.phase === "active" ? "kola" : "prijave"}`}
        sx={{flex: "none", display: "flex", alignItems: "center", gap: "14px", p: "16px", borderRadius: "22px", background: color.navy, color: color.white, textDecoration: "none", boxShadow: shadow.hero}}
      >
        <Box component="span" aria-hidden sx={{width: 44, height: 44, flex: "none", borderRadius: "50%", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 26}}}>
          <PlayCircleRoundedIcon />
        </Box>
        <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px"}}>
          <Box component="span" sx={{fontSize: 17, fontWeight: 700, ...ellipsis}}>
            {t.name}
          </Box>
          {t.phase === "upcoming" && t.day ? (
            <AdminDayLine t={t} />
          ) : (
            <Box component="span" sx={{fontSize: 14, color: color.cream}}>
              {t.live_kolo ? `Kolo ${t.live_kolo} uživo` : `Odigrano ${t.completed_kolos} od ${t.rounds} kola`}
            </Box>
          )}
        </Box>
        <ChevronRightRoundedIcon aria-hidden sx={{fontSize: 26}} />
      </Box>
    </Box>
  );
}
