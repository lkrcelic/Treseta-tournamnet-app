"use client";

import {OngoingMatchExtendedResponse} from "@/app/_interfaces/match";
import {clockLabel, TIME_WARNING_MS} from "@/app/_lib/gameTime";
import {color, font, shadow, tint} from "@/app/_styles/tokens";
import {PrimaryButton} from "@/app/_ui/sp";
import TimerOffRoundedIcon from "@mui/icons-material/TimerOffRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import {Box, Dialog} from "@mui/material";
import {useEffect, useState} from "react";

// Vrijeme partije on the scorepad: the time left beside the target's flag (muted grey, red in the last 5 minutes),
// "Još 5:00 do kraja partije" once per match on the board's main screen, and what the board says when the time is up
// (the score entered then counts; with the score level one more hand). A raised target (41 → 51 → 61 …) gives the
// match five more minutes, which the server works out, so the timer simply follows ends_at. The server's clock counts
// (server_now), not the phone's.

const WARNED_KEY = "treseta.timeWarned";

export type MatchClock = {
  // ms left; null without a limit
  left: number | null;
  warn: boolean;
  expired: boolean;
};

export function useMatchClock(match: Pick<OngoingMatchExtendedResponse, "id" | "ends_at" | "server_now">): MatchClock {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!match.server_now) return;
    setOffset(Date.parse(match.server_now) - Date.now());
  }, [match.server_now]);
  const ends = match.ends_at ? new Date(match.ends_at).getTime() : null;
  useEffect(() => {
    if (ends == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ends]);
  if (ends == null) return {left: null, warn: false, expired: false};
  const left = ends - (now + offset);
  return {left, warn: left <= TIME_WARNING_MS, expired: left <= 0};
}

// "timer 23:41" beside the match's target: grey, red in the last 5 minutes
export function TimerChip({clock}: {clock: MatchClock}) {
  if (clock.left == null) return null;
  const tone = clock.warn ? color.red : color.muted;
  return (
    <Box
      component="span"
      role="timer"
      aria-label={`Do kraja partije ${clockLabel(clock.left)}`}
      sx={{display: "inline-flex", alignItems: "center", gap: "4px", color: tone, fontFamily: font.display, fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", "& svg": {fontSize: 19}}}
    >
      {clock.expired ? <TimerOffRoundedIcon aria-hidden /> : <TimerRoundedIcon aria-hidden />}
      {clockLabel(clock.left)}
    </Box>
  );
}

function warned(matchId: number): boolean {
  try {
    return (JSON.parse(window.localStorage.getItem(WARNED_KEY) ?? "[]") as number[]).includes(matchId);
  } catch {
    return false;
  }
}

function markWarned(matchId: number) {
  try {
    const list = JSON.parse(window.localStorage.getItem(WARNED_KEY) ?? "[]") as number[];
    window.localStorage.setItem(WARNED_KEY, JSON.stringify([...list.slice(-40), matchId]));
  } catch {
    // private mode: it may show once more
  }
}

// "Još 5:00 do kraja partije": once per match, on the board's main screen (never over the hand's steps)
export function TimeWarning({matchId, clock}: {matchId: number; clock: MatchClock}) {
  const due = clock.left != null && clock.warn && !clock.expired;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (due && !warned(matchId)) setOpen(true);
  }, [due, matchId]);
  const close = () => {
    markWarned(matchId);
    setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      PaperProps={{sx: {m: "20px", width: "calc(100% - 40px)", maxWidth: 380, borderRadius: "26px", p: "22px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", boxShadow: shadow.sheet, textAlign: "center"}}}
      slotProps={{backdrop: {sx: {background: tint.scrim[42]}}}}
    >
      <Box aria-hidden sx={{width: 56, height: 56, borderRadius: "16px", background: tint.red[12], color: color.red, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 30}}}>
        <TimerRoundedIcon />
      </Box>
      <Box component="h2" sx={{m: 0, fontFamily: font.display, fontSize: 26, fontWeight: 800, lineHeight: 1.1}}>
        Još {clockLabel(Math.max(0, clock.left ?? 0))}
        <Box component="span" sx={{display: "block", fontSize: 18, fontWeight: 700, color: color.ink2}}>
          do kraja partije
        </Box>
      </Box>
      <Box sx={{fontSize: 15, lineHeight: 1.45, color: color.ink2}}>
        Kad vrijeme istekne, partija završava s rezultatom koji je tada upisan, a igra koja još nije spremljena ne
        računa se. Pobjeđuje ekipa s više bodova. Ako se cilj podigne, partija dobiva još pet minuta.
      </Box>
      <PrimaryButton onClick={close} sx={{alignSelf: "stretch", height: 54, fontSize: 16}}>
        U redu
      </PrimaryButton>
    </Dialog>
  );
}

// What the board says once the time is up: the score entered counts (the match closes at once and the board moves on),
// or with the score level one more hand is played
export function TimeUpNote({tied}: {tied: boolean}) {
  return (
    <Box role="status" sx={{display: "flex", gap: "10px", p: "14px 16px", borderRadius: "18px", background: tied ? tint.gold[16] : tint.red[10], color: color.ink, fontSize: 15, lineHeight: 1.45, "& svg": {fontSize: 22, color: tied ? color.ink2 : color.red, flex: "none"}}}>
      <TimerOffRoundedIcon aria-hidden />
      <span>
        {tied
          ? "Vrijeme je isteklo, rezultat je izjednačen. Odigrajte još jednu igru. Nakon upisa te igre partija završava."
          : "Vrijeme je isteklo. Partija završava s rezultatom koji je upisan: pobjeđuje ekipa s više bodova."}
      </span>
    </Box>
  );
}
