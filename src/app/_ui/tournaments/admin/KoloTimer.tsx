"use client";

import {KoloView} from "@/app/_interfaces/tournament";
import {leagueClock} from "@/app/_lib/dates";
import {durationLabel, elapsedLabel} from "@/app/_lib/gameTime";
import {color, font, tint} from "@/app/_styles/tokens";
import {tabular} from "@/app/_ui/sp";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import {Box, SxProps, Theme} from "@mui/material";
import {useEffect, useState} from "react";

// Vrijeme kola, the admin's timer of a Kolo: it runs from the moment the Kolo is published until its last table is
// closed, then it says how long the Kolo lasted. Upravljanje turnirom shows it on the computer (Kolo N traje, the Kolo
// over the whole screen) and the phone (the navy card, the Kolo's screen, the list of Kolos). The times are the
// server's (published_at and the last close, koloTimes); the phone's clock only counts the seconds between them.

export type KoloClock = {
  // still being played: the seconds go on
  running: boolean;
  // how long it has been going, or how long it lasted
  ms: number;
  // "20:14", and "21:06" once it is over
  from: string;
  to: string | null;
};

export function useKoloClock(kolo: Pick<KoloView, "started_at" | "ended_at"> | null | undefined): KoloClock | null {
  const started = kolo?.started_at ? Date.parse(kolo.started_at) : null;
  const ended = kolo?.ended_at ? Date.parse(kolo.ended_at) : null;
  const running = started != null && ended == null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running, started]);
  if (started == null) return null;
  return {
    running,
    ms: Math.max(0, (ended ?? now) - started),
    from: leagueClock(new Date(started)),
    to: ended != null ? leagueClock(new Date(ended)) : null,
  };
}

// "23:41" while it runs, "52 min" once it is over
export const koloClockText = (c: KoloClock) => (c.running ? elapsedLabel(c.ms) : durationLabel(c.ms));
const koloClockLabel = (c: KoloClock) => (c.running ? `Kolo traje ${elapsedLabel(c.ms)}, od ${c.from}` : `Kolo je trajalo ${durationLabel(c.ms)}, ${c.from} – ${c.to}`);

// A chip beside the Kolo's status: the timer running (navy) or the time it took (grey)
export function KoloTimerChip({kolo, height = 32, fontSize = 14, sx}: {kolo: KoloView; height?: number; fontSize?: number; sx?: SxProps<Theme>}) {
  const c = useKoloClock(kolo);
  if (!c) return null;
  return (
    <Box
      component="span"
      role="timer"
      aria-label={koloClockLabel(c)}
      sx={[
        {
          flex: "none",
          height,
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          px: "10px",
          borderRadius: "10px",
          background: c.running ? tint.navy[10] : color.lineFill,
          color: c.running ? color.navy : color.ink2,
          fontFamily: font.display,
          fontSize,
          fontWeight: 800,
          whiteSpace: "nowrap",
          ...tabular,
          "& svg": {fontSize: fontSize + 4},
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {c.running ? <TimerRoundedIcon aria-hidden /> : <TimerOutlinedIcon aria-hidden />}
      {c.running ? elapsedLabel(c.ms) : `Trajalo ${durationLabel(c.ms)}`}
    </Box>
  );
}

// " · 23:41" or " · 52 min" after a Kolo's tables in the phone's list of Kolos
export function ListDuration({kolo}: {kolo: KoloView}) {
  const c = useKoloClock(kolo);
  return c ? <> · {koloClockText(c)}</> : null;
}

// The navy card's timer on the phone (Kolo N u tijeku): cream on navy, beside the tables' progress
export function KoloTimerOnNavy({kolo}: {kolo: KoloView}) {
  const c = useKoloClock(kolo);
  if (!c) return null;
  return (
    <Box
      component="span"
      role="timer"
      aria-label={koloClockLabel(c)}
      sx={{flex: "none", display: "inline-flex", alignItems: "center", gap: "5px", color: color.cream, fontFamily: font.display, fontSize: 17, fontWeight: 800, lineHeight: 1, ...tabular, "& svg": {fontSize: 19}}}
    >
      <TimerRoundedIcon aria-hidden />
      {koloClockText(c)}
    </Box>
  );
}

// Kolo N traje on the computer: the big timer with the time the Kolo started; once it is played, how long it lasted
// and from when to when
export function KoloTimerPanel({kolo}: {kolo: KoloView}) {
  const c = useKoloClock(kolo);
  if (!c) return null;
  return (
    <Box
      role="timer"
      aria-label={koloClockLabel(c)}
      sx={{display: "flex", alignItems: "center", gap: "12px", p: "12px 14px", borderRadius: "16px", background: c.running ? color.cream : color.lineFill}}
    >
      <Box
        component="span"
        aria-hidden
        sx={{width: 40, height: 40, flex: "none", borderRadius: "12px", background: c.running ? color.navy : color.white, color: c.running ? color.cream : color.ink2, display: "flex", alignItems: "center", justifyContent: "center", "& svg": {fontSize: 24}}}
      >
        {c.running ? <TimerRoundedIcon /> : <TimerOutlinedIcon />}
      </Box>
      <Box sx={{flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px"}}>
        <Box component="span" sx={{fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: c.running ? color.navy : color.muted}}>
          {c.running ? "Vrijeme kola" : "Kolo je trajalo"}
        </Box>
        <Box component="span" sx={{fontFamily: font.display, fontSize: 30, fontWeight: 800, lineHeight: 1.05, color: color.ink, ...tabular}}>
          {koloClockText(c)}
        </Box>
      </Box>
      <Box component="span" sx={{flex: "none", fontSize: 14, color: color.ink2, ...tabular, whiteSpace: "nowrap"}}>
        {c.running ? `od ${c.from}` : `${c.from} – ${c.to}`}
      </Box>
    </Box>
  );
}
