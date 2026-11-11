"use client";

import {MATCH_THRESHOLD, Side} from "@/app/_lib/game/scoring";
import {color} from "@/app/_styles/tokens";
import {BottomSheet, ErrorNote, Muted, PrimaryButton, TextButton} from "@/app/_ui/sp";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import {Box} from "@mui/material";
import React, {useRef} from "react";

// The end of a match as Treseta has it, shared by the players' scoreboard and the admin scorepad:
// the "s ovim dosta" question after a custom hand, the flag of a target raised by a tie, and "na prolaz" the flag of a
// level score at or above the target (one more hand).

export type DostaTeam = {side: Side; name: string; color: string};

// Asked after a custom hand that took a team to the target. Only one team can have called it; "Ne" leaves the
// match to the normal rules.
export function DostaPrompt({
  teams,
  onPick,
  onSkip,
  busy,
  error,
}: {
  // the teams that reached the target with the hand
  teams: DostaTeam[];
  onPick: (side: Side) => void;
  onSkip: () => void;
  busy: boolean;
  error: string | null;
}) {
  // the sheet keeps its teams while it slides away
  const shown = useRef(teams);
  if (teams.length > 0) shown.current = teams;
  return (
    <BottomSheet open={teams.length > 0} onClose={onSkip} title="Je li netko zvao „s ovim dosta”?">
      <Box sx={{display: "flex", flexDirection: "column", gap: "12px", px: "8px"}}>
        <Muted>Ekipa koja je zvala i došla do cilja pobjeđuje meč, i s manje bodova.</Muted>
        {shown.current.map((t) => (
          <PrimaryButton key={t.side} bg={t.color} onClick={() => onPick(t.side)} disabled={busy}>
            {t.name}
          </PrimaryButton>
        ))}
        {error && <ErrorNote>{error}</ErrorNote>}
        <TextButton onClick={onSkip} disabled={busy}>
          Ne, nitko nije zvao
        </TextButton>
      </Box>
    </BottomSheet>
  );
}

// "Na prolaz", the teams level at or above the target: one more hand is played (with five more minutes). Pops in when
// it appears.
export function LevelFlag() {
  return (
    <Box role="status" aria-label="Izjednačeno, igra se još jedna igra" sx={flagSx}>
      <FlagRoundedIcon />
      Izjednačeno · još jedna igra
    </Box>
  );
}

const flagSx = {
  alignSelf: "center",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  height: 32,
  px: "12px",
  borderRadius: "16px",
  background: color.cream,
  color: color.navy,
  fontSize: 14,
  fontWeight: 700,
  whiteSpace: "nowrap",
  animation: "spFadeUp 320ms ease both, spPop 480ms 320ms ease",
  "& svg": {fontSize: 18, color: color.red},
} as const;

// "Do 51": the match is played past 41 — the teams were level at or above the target, so it went up, or the match
// started there (a tournament played to 51; base: the target it started with). Pops in when it appears.
export function TargetFlag({target, base = MATCH_THRESHOLD}: {target: number; base?: number}) {
  if (target <= MATCH_THRESHOLD) return null;
  return (
    <Box
      key={target}
      role="status"
      aria-label={target > base ? `Izjednačeno, igra se do ${target}` : `Igra se do ${target}`}
      sx={flagSx}
    >
      <FlagRoundedIcon />
      Do {target}
    </Box>
  );
}
