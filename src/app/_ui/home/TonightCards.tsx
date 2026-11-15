"use client";

import useConferences from "@/app/_hooks/useConferences";
import {MyLeague, MyLeagueTonight} from "@/app/_interfaces/burza";
import {color, font, shadow, teamOnNavy, tint} from "@/app/_styles/tokens";
import {ellipsis, TeamDot} from "@/app/_ui/sp";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import {Box} from "@mui/material";
import React from "react";

// Početna's new league cards (Claude Design 01 A, Nove kartice; LOCATIONS_PLAN.md, decision 21), on every league night,
// one place or two: Sljedeći stol between the team's tables, Pauza for a Kolo the team sits out, and Nema zakazane
// večeri when there is no table and no night. Kraj večeri is the night's card with its own box (NextNightCard).

// "Kolo 1/3": which of the place's published Kola tonight it is
export const koloLabel = ([k, n]: [number, number]) => `Kolo ${k}/${n}`;

const chipSx = {height: 28, display: "flex", alignItems: "center", px: "10px", borderRadius: "9px", background: color.cream, color: color.navy, fontSize: 13, fontWeight: 800, letterSpacing: ".08em", whiteSpace: "nowrap"} as const;

// The navy card of Započni igru's shape with an hourglass in place of the play button: the next table appears here
function WaitingCard({label, top, line}: {label: string; top: React.ReactNode; line: string}) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{flex: "none", minHeight: 200, boxSizing: "border-box", borderRadius: "24px", background: color.navy, color: color.white, p: "20px 20px 22px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "14px", boxShadow: shadow.hero}}
    >
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "8px", minWidth: 0}}>{top}</Box>
        <Box component="span" aria-hidden sx={{width: 52, height: 52, flex: "none", borderRadius: "50%", background: tint.creamOnNavy[16], color: color.cream, display: "flex", alignItems: "center", justifyContent: "center"}}>
          <HourglassTopRoundedIcon sx={{fontSize: 30}} />
        </Box>
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
        <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 42, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1, whiteSpace: "nowrap"}}>
          Sljedeći stol
        </Box>
        <Box component="span" sx={{fontSize: 14, lineHeight: 1.4, color: color.cream}}>
          {line}
        </Box>
      </Box>
    </Box>
  );
}

// Sljedeći stol (card 14): the team played its table and the place's next Kolo isn't published yet. The table it
// played, "Kolo 1/3 · 2 : 0", its team and the opponent (dimmed).
export function NextTableCard({league, last}: {league: MyLeague; last: NonNullable<MyLeagueTonight["lastTable"]>}) {
  const conferences = useConferences(league.league_id);
  const dot = (teamId: number, side: number) =>
    conferences.conferences.length ? <TeamDot color={conferences.of(teamId)?.color ?? null} ring onNavy /> : <TeamDot color={teamOnNavy[side]} />;
  return (
    <WaitingCard
      label="Sljedeći stol"
      line="Pojavit će se ovdje čim organizator objavi iduće kolo."
      top={
        <>
          <Box sx={{display: "flex", alignItems: "center", gap: "8px"}}>
            <Box component="span" sx={chipSx}>
              STOL {last.table ?? "–"}
            </Box>
            <Box component="span" sx={{fontSize: 13, fontWeight: 700, color: color.cream, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums"}}>
              {koloLabel(last.kolo)} · {last.score[0]} : {last.score[1]}
            </Box>
          </Box>
          <Box sx={{display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.2}}>
            <Box component="span" sx={{display: "flex", alignItems: "center", gap: "8px", minWidth: 0}}>
              {dot(league.team_id, 0)}
              <Box component="span" sx={ellipsis}>
                {league.team_name}
              </Box>
            </Box>
            <Box component="span" sx={{display: "flex", alignItems: "center", gap: "8px", minWidth: 0, opacity: 0.6}}>
              {dot(last.opponentId, 1)}
              <Box component="span" sx={ellipsis}>
                {last.opponent}
              </Box>
            </Box>
          </Box>
        </>
      }
    />
  );
}

// Pauza (card 15): the team sits out a Kolo (an odd number of teams) that isn't the place's last. place: on a
// two-place night, the team's place.
export function ByeCard({kolo, place}: {kolo: [number, number]; place: string | null}) {
  return (
    <WaitingCard
      label="Pauza"
      line="Igrate u idućem kolu; stol će se pojaviti ovdje čim ga organizator objavi."
      top={
        <>
          <Box component="span" sx={{...chipSx, alignSelf: "flex-start"}}>
            {koloLabel(kolo).toUpperCase()}
          </Box>
          <Box sx={{display: "flex", flexDirection: "column", gap: "2px"}}>
            <Box component="span" sx={{fontSize: 17, fontWeight: 600, lineHeight: 1.2}}>
              Ovo kolo pauzirate
            </Box>
            <Box component="span" sx={{fontSize: 13, color: color.cream}}>
              {place ? `Neparan broj ekipa na lokaciji ${place}.` : "Neparan broj ekipa večeras."}
            </Box>
          </Box>
        </>
      }
    />
  );
}

// A white card with a cream icon, a title and a line (card 17 Nema zakazane večeri, and Turniri's Nema nadolazećih
// turnira)
export function QuietCard({title, text, icon = <EventRoundedIcon />}: {title: string; text: string; icon?: React.ReactNode}) {
  return (
    <Box component="section" aria-label={title} sx={{flex: "none", borderRadius: "24px", background: color.white, boxShadow: shadow.raised, p: "20px 22px", display: "flex", gap: "14px", alignItems: "center"}}>
      <Box component="span" aria-hidden sx={{width: 52, height: 52, flex: "none", borderRadius: "16px", background: color.cream, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 28}}}>
        {icon}
      </Box>
      <Box sx={{display: "flex", flexDirection: "column", gap: "4px", minWidth: 0}}>
        <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 20, fontWeight: 800, lineHeight: 1.15, color: color.ink}}>
          {title}
        </Box>
        <Box component="span" sx={{fontSize: 14, lineHeight: 1.45, color: color.muted}}>
          {text}
        </Box>
      </Box>
    </Box>
  );
}

// Nema zakazane večeri (card 17): no table and no night to come, in place of the grey locked Započni igru
export function NoNightCard() {
  return <QuietCard title="Nema zakazane večeri" text="Kad budete na rasporedu, ovdje piše kada i gdje igrate." />;
}
