"use client";

import {PlayerRatingDetail} from "@/app/_interfaces/ratings";
import {changeTone, formatChange, nightResult, RATING_COLUMNS, RATING_HOW, ratingChart, roundsLabel, shortDate} from "@/app/_lib/ui/ratings";
import {color, font} from "@/app/_styles/tokens";
import {buttonBase, Card, ellipsis, tabular} from "@/app/_ui/sp";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import {Box} from "@mui/material";
import React from "react";

// Pieces of the ratings page (Claude Design "Rejting igrača"), shared by the phone and desktop layouts

const TONE_INK = {up: color.green, down: color.red, flat: color.muted} as const;
const RESULT_BG = {up: "rgba(56,102,65,.12)", down: "rgba(188,71,73,.1)", flat: color.paperDeep} as const;
const RESULT_INK = {up: color.green, down: color.red, flat: color.inkSoft} as const;

export const changeInk = (change: number | null) => TONE_INK[changeTone(change)];

// a rating that is still settling (few rounds)
export function ProvisionalTag({size = "sm"}: {size?: "sm" | "md" | "lg"}) {
  const h = {sm: 18, md: 22, lg: 24}[size];
  return (
    <Box
      component="span"
      sx={{height: h, flex: "none", display: "inline-flex", alignItems: "center", px: size === "sm" ? "6px" : "7px", borderRadius: size === "sm" ? "6px" : "7px", border: "1px solid rgba(60,74,103,.4)", fontSize: {sm: 10.5, md: 11.5, lg: 12}[size], fontWeight: 700, color: color.navy, whiteSpace: "nowrap"}}
    >
      Privremeno
    </Box>
  );
}

export function RankDot({rank, size = 28}: {rank: number; size?: number}) {
  return (
    <Box
      component="span"
      sx={{width: size, height: size, flex: "none", borderRadius: "50%", background: color.paperDeep, color: color.navy, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", ...tabular}}
    >
      {rank}
    </Box>
  );
}

// The cream card on top of a player's detail: name, team, rounds, the big rating, the last change and the place
export function PlayerCard({detail, desktop = false}: {detail: PlayerRatingDetail; desktop?: boolean}) {
  const {player, total} = detail;
  return (
    <Box component="section" aria-label="Rejting igrača" sx={{background: color.cream, borderRadius: "24px", p: desktop ? "22px" : "20px", display: "flex", flexDirection: "column", gap: "14px", flex: "none"}}>
      <Box sx={{display: "flex", flexDirection: "column", gap: "3px"}}>
        <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 28, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.01em", textWrap: "pretty"}}>
          {player.name}
        </Box>
        <Box sx={{fontSize: 15, color: color.inkSoft}}>{[player.team, roundsLabel(player.rounds)].filter(Boolean).join(" · ")}</Box>
      </Box>
      <Box sx={{display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px"}}>
        <Box sx={{display: "flex", flexDirection: "column", gap: "6px"}}>
          <Box sx={{fontFamily: font.display, fontSize: desktop ? 60 : 64, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-.03em", ...tabular}}>
            {player.rating}
            <VisuallyHiddenText> bodova rejtinga</VisuallyHiddenText>
          </Box>
          {player.provisional && (
            <Box sx={{alignSelf: "flex-start"}}>
              <ProvisionalTag size="lg" />
            </Box>
          )}
        </Box>
        <Box sx={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", pb: "4px"}}>
          {player.rounds > 0 && (
            <Box component="span" sx={{height: 30, display: "flex", alignItems: "center", px: "10px", borderRadius: "15px", background: color.card, color: changeInk(player.change), fontSize: desktop ? 15 : 16, fontWeight: 700, whiteSpace: "nowrap", ...tabular}}>
              {formatChange(player.change)} zadnja večer
            </Box>
          )}
          <Box component="span" sx={{fontSize: 14, fontWeight: 600, color: color.navy, whiteSpace: "nowrap"}}>
            #{player.rank} od {total}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// "Kroz večeri": the rating after each night, from the 1500 start
export function RatingChartCard({detail, width}: {detail: PlayerRatingDetail; width: number}) {
  const H = 130;
  const chart = ratingChart(detail.history.map((h) => h.rating), width, H);
  const first = detail.history[0];
  const last = detail.history[detail.history.length - 1];
  return (
    <Card component="section" aria-label="Rejting kroz večeri" sx={{borderRadius: "22px", p: "16px 16px 12px", display: "flex", flexDirection: "column", gap: "10px", flex: "none"}}>
      <Box sx={{fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>Kroz večeri</Box>
      <Box component="svg" viewBox={`0 0 ${width} ${H}`} width="100%" role="img" aria-label={`Rejting od ${first ? shortDate(first.night) : ""} do ${last ? shortDate(last.night) : ""}: sada ${detail.player.rating}`} sx={{display: "block", overflow: "visible"}}>
        <path d={chart.area} fill="rgba(60,74,103,.07)" />
        <line x1={0} x2={width} y1={chart.baseY} y2={chart.baseY} stroke="#B8B2A4" strokeWidth={1.5} strokeDasharray="4 4" />
        <path d={chart.line} fill="none" stroke={color.navy} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={chart.end.x} cy={chart.end.y} r={5} fill={color.navy} stroke="#FFFFFF" strokeWidth={2} />
      </Box>
      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: color.muted, ...tabular}}>
        <span>{first ? shortDate(first.night) : ""}</span>
        <Box component="span" sx={{display: "flex", alignItems: "center", gap: "6px"}}>
          <Box component="span" aria-hidden sx={{width: 16, borderTop: "1.5px dashed #B8B2A4"}} />
          Početak 1500
        </Box>
        <span>{last ? shortDate(last.night) : ""}</span>
      </Box>
    </Card>
  );
}

// The player's last five nights: date, who they played, matches won:lost, the change
export function LastNights({detail, desktop = false}: {detail: PlayerRatingDetail; desktop?: boolean}) {
  const rows = detail.lastNights.map((n) => {
    const res = nightResult(n.won, n.lost);
    return (
      <Box
        component="li"
        key={n.night}
        sx={{height: desktop ? 50 : 54, display: "grid", gridTemplateColumns: `${desktop ? 56 : 52}px minmax(0,1fr) auto ${desktop ? 52 : 48}px`, gap: "10px", alignItems: "center", px: desktop ? "18px" : "16px", borderTop: desktop ? "1px solid rgba(60,74,103,.07)" : undefined, borderBottom: desktop ? undefined : "1px solid rgba(60,74,103,.08)", "&:last-of-type": desktop ? undefined : {borderBottom: "none"}}}
      >
        <Box component="span" sx={{fontSize: 14, color: color.muted, ...tabular}}>
          {shortDate(n.night)}
        </Box>
        <Box component="span" title={n.opponents.join(", ")} sx={{fontSize: 15, fontWeight: 600, ...ellipsis}}>
          {n.opponents.length ? `vs ${n.opponents.join(", ")}` : "—"}
        </Box>
        <Box component="span" aria-label={`mečevi ${res.label}`} sx={{height: 26, display: "flex", alignItems: "center", px: "8px", borderRadius: "8px", background: RESULT_BG[res.tone], color: RESULT_INK[res.tone], fontSize: 14, fontWeight: 700, ...tabular}}>
          {res.label}
        </Box>
        <Box component="span" sx={{textAlign: "right", fontSize: 15, fontWeight: 700, color: changeInk(n.change), ...tabular}}>
          {formatChange(n.change)}
        </Box>
      </Box>
    );
  });

  if (desktop) {
    return (
      <Card component="section" aria-labelledby="rt-nights" sx={{borderRadius: "22px", overflow: "hidden", flex: "none"}}>
        <Box id="rt-nights" sx={{p: "14px 18px 6px", fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
          Zadnje večeri
        </Box>
        <Box component="ol" sx={{listStyle: "none", m: 0, p: 0}}>
          {rows}
        </Box>
      </Card>
    );
  }
  return (
    <Box component="section" aria-labelledby="rt-nights" sx={{display: "flex", flexDirection: "column", gap: "8px", flex: "none"}}>
      <Box id="rt-nights" sx={{px: "6px", fontSize: 13, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: color.muted}}>
        Zadnje večeri
      </Box>
      <Card component="ol" sx={{listStyle: "none", m: 0, p: 0, borderRadius: "22px", overflow: "hidden"}}>
        {rows}
      </Card>
    </Box>
  );
}

export function NoRoundsCard() {
  return (
    <Card sx={{borderRadius: "22px", p: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center", flex: "none"}}>
      <Box aria-hidden sx={{width: 60, height: 60, borderRadius: "50%", background: color.paper, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 30}}}>
        <StyleRoundedIcon />
      </Box>
      <Box sx={{fontFamily: font.display, fontSize: 21, fontWeight: 800}}>Još nema odigranih kola</Box>
      <Box sx={{fontSize: 15, lineHeight: 1.45, color: color.muted, textWrap: "pretty"}}>Rejting kreće od 1500 i mijenja se nakon prve odigrane večeri.</Box>
    </Card>
  );
}

export type InfoView = "cols" | "how";
export const infoTitle = (view: InfoView) => (view === "how" ? "Kako se računa rejting?" : "Što znače stupci?");

// "Što znače stupci?" (every column in one sentence) and "Kako se računa rejting?", with a button to switch
export function RatingsInfo({view, onSwitch, compact = false}: {view: InfoView; onSwitch: (view: InfoView) => void; compact?: boolean}) {
  const switchSx = {...buttonBase, height: compact ? 44 : 52, borderRadius: compact ? "12px" : "16px", background: color.paper, color: color.navy, fontSize: compact ? 15 : 16, fontWeight: 600, display: "flex", alignItems: "center", "& svg": {fontSize: compact ? 20 : 22}} as const;
  if (view === "how") {
    return (
      <>
        <Box component="ol" sx={{listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: compact ? "8px" : "14px"}}>
          {RATING_HOW.map((t, i) => (
            <Box component="li" key={t} sx={{display: "flex", gap: compact ? "12px" : "14px", alignItems: "flex-start", py: compact ? "4px" : 0}}>
              <Box component="span" aria-hidden sx={{width: compact ? 28 : 30, height: compact ? 28 : 30, flex: "none", borderRadius: "50%", background: color.navy, color: "#FFFFFF", fontSize: compact ? 13 : 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"}}>
                {i + 1}
              </Box>
              <Box component="span" sx={{pt: compact ? "3px" : "4px", fontSize: compact ? 15 : 16, lineHeight: 1.45, color: color.ink, textWrap: "pretty"}}>
                {t}
              </Box>
            </Box>
          ))}
        </Box>
        <Box component="button" type="button" onClick={() => onSwitch("cols")} sx={{...switchSx, gap: "6px", px: compact ? "10px" : "12px"}}>
          <ChevronLeftRoundedIcon />
          Što znače stupci?
        </Box>
      </>
    );
  }
  return (
    <>
      <Box component="dl" sx={{m: 0, display: "flex", flexDirection: "column"}}>
        {RATING_COLUMNS.map(([k, v], i) => (
          <Box key={k} sx={{display: "grid", gridTemplateColumns: `${compact ? 96 : 92}px minmax(0,1fr)`, gap: "12px", alignItems: "start", py: compact ? "8px" : "12px", borderBottom: i < RATING_COLUMNS.length - 1 ? "1px solid rgba(60,74,103,.08)" : "none"}}>
            <Box component="dt" sx={{justifySelf: "start", height: compact ? 24 : 26, display: "flex", alignItems: "center", px: compact ? "8px" : "9px", borderRadius: compact ? "7px" : "8px", background: k === "Privremeno" ? "transparent" : color.paper, border: k === "Privremeno" ? "1px solid rgba(60,74,103,.4)" : "1px solid transparent", color: color.navy, fontSize: compact ? 12.5 : 13, fontWeight: 700}}>
              {k}
            </Box>
            <Box component="dd" sx={{m: 0, fontSize: compact ? 14 : 15, lineHeight: 1.45, color: "#2A3043", textWrap: "pretty"}}>
              {v}
            </Box>
          </Box>
        ))}
      </Box>
      <Box component="button" type="button" onClick={() => onSwitch("how")} sx={{...switchSx, justifyContent: "space-between", px: compact ? "14px" : "16px"}}>
        Kako se računa rejting?
        <ChevronRightRoundedIcon />
      </Box>
    </>
  );
}

function VisuallyHiddenText({children}: {children: React.ReactNode}) {
  return (
    <Box component="span" sx={{position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap"}}>
      {children}
    </Box>
  );
}
