"use client";

import {TournamentCard} from "@/app/_interfaces/tournament";
import {dateTile} from "@/app/_lib/nights";
import {formatLabel, TournamentStatusLabel, tournamentStatus} from "@/app/_lib/tournaments";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, mergeSx} from "@/app/_ui/sp";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import {Box, SxProps, Theme} from "@mui/material";
import React from "react";

// Small pieces the tournament screens share (Turniri, the player's and the admin's)

// The cream date tile of a tournament: SUB · 31 · LIS (grey once it is over). size: the tile's width
export function DateTile({date, size = 52, done = false, sx}: {date: string; size?: number; done?: boolean; sx?: SxProps<Theme>}) {
  const d = dateTile(date);
  if (!d) return null;
  return (
    <Box
      aria-hidden
      sx={mergeSx(
        {
          flex: "none",
          width: size,
          height: Math.round(size * 1.08),
          borderRadius: `${Math.round(size * 0.27)}px`,
          background: done ? color.lineFill : color.cream,
          color: done ? color.muted : color.navy,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          gap: `${Math.round(size * 0.03)}px`,
        },
        sx
      )}
    >
      <Box component="span" sx={{fontSize: Math.round(size * 0.2), fontWeight: 800, letterSpacing: ".06em"}}>
        {d.weekday}
      </Box>
      <Box component="span" sx={{fontFamily: font.display, fontSize: Math.round(size * 0.44), fontWeight: 800, color: done ? color.ink2 : color.ink}}>
        {d.day}
      </Box>
      <Box component="span" sx={{fontSize: Math.round(size * 0.2), fontWeight: 800, letterSpacing: ".06em"}}>
        {d.month}
      </Box>
    </Box>
  );
}

const STATUS_LOOK: Record<TournamentStatusLabel["kind"], {ink: string; bg: string; icon: React.ReactNode}> = {
  open: {ink: color.green, bg: tint.green[12], icon: <HowToRegRoundedIcon />},
  waiting: {ink: color.medal[0], bg: tint.gold[16], icon: <HourglassTopRoundedIcon />},
  closed: {ink: color.muted, bg: color.lineFill, icon: <LockRoundedIcon />},
  live: {ink: color.red, bg: tint.red[10], icon: <RadioButtonCheckedRoundedIcon />},
  finished: {ink: color.navy, bg: tint.navy[12], icon: <EmojiEventsRoundedIcon />},
  cancelled: {ink: color.red, bg: tint.red[10], icon: <CancelRoundedIcon />},
};

// A tournament's state in the admin's lists: Prijave otvorene, Lista čekanja · 3, Prijave zatvorene, Uživo, Završeno,
// Otkazan
export function StatusChip({status, height = 28, sx}: {status: TournamentStatusLabel; height?: number; sx?: SxProps<Theme>}) {
  const look = STATUS_LOOK[status.kind];
  return (
    <Box
      component="span"
      sx={mergeSx(
        {flex: "none", alignSelf: "flex-start", height, display: "inline-flex", alignItems: "center", gap: "5px", px: "9px", borderRadius: "9px", background: look.bg, color: look.ink, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", "& svg": {fontSize: 16}},
        sx
      )}
    >
      {look.icon}
      {status.label}
    </Box>
  );
}

export const statusOf = (t: Pick<TournamentCard, "phase" | "registrations_open" | "waiting">) => tournamentStatus(t.phase, t.registrations_open, t.waiting);

// "10:00 · 9 kola · zvanja" (the admin's list) or with the teams: "· 22 / 24 ekipa"
export function tournamentMeta(t: Pick<TournamentCard, "start_time" | "rounds" | "matches_per_round" | "declarations">): string {
  return [t.start_time, formatLabel(t.rounds, t.matches_per_round), t.declarations ? "zvanja" : "bez zvanja"].filter(Boolean).join(" · ");
}

export type ViewTab<K extends string> = {key: K; label: string; icon: React.ReactNode; count?: number | null};

// The tabs on top of Upravljanje turnirom (the same white pill as Upravljanje ligom's)
export function ViewTabs<K extends string>({items, value, onChange, label}: {items: ViewTab<K>[]; value: K; onChange: (k: K) => void; label: string}) {
  return (
    <Box role="tablist" aria-label={label} sx={{flex: "none", alignSelf: "flex-start", display: "flex", gap: "4px", p: "4px", borderRadius: "16px", background: color.white, boxShadow: shadow.card}}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Box
            key={it.key}
            component="button"
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(it.key)}
            sx={{
              ...buttonBase,
              height: 42,
              px: "18px",
              borderRadius: "12px",
              background: on ? color.navy : "transparent",
              color: on ? color.white : color.ink,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: 15,
              fontWeight: 600,
              transition: "background 160ms ease",
              "& svg": {fontSize: 20},
            }}
          >
            {it.icon}
            {it.label}
            {it.count != null && (
              <Box component="span" sx={{fontSize: 12, fontWeight: 700, color: on ? color.cream : color.faint}}>
                {it.count}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// The fill bar of the sign-ups (22 of 24 places); without a limit, none
export function FillBar({registered, max, onNavy = false, sx}: {registered: number; max: number | null; onNavy?: boolean; sx?: SxProps<Theme>}) {
  if (max == null) return null;
  const share = Math.min(1, registered / Math.max(1, max));
  return (
    <Box aria-hidden sx={mergeSx({height: 6, borderRadius: "3px", background: onNavy ? tint.white[14] : color.lineFill, overflow: "hidden"}, sx)}>
      <Box sx={{height: "100%", width: `${share * 100}%`, borderRadius: "3px", background: onNavy ? color.cream : color.navy}} />
    </Box>
  );
}
