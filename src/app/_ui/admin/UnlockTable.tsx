"use client";

import {TablePad, PadLock} from "@/app/_interfaces/adminHand";
import {unlockTableAPI} from "@/app/_fetchers/admin/daily";
import {UNLOCK_KOLO_WARNING, unlockEffects} from "@/app/_lib/tableLock";
import {color, tint} from "@/app/_styles/tokens";
import {BottomSheet, buttonBase, ErrorNote, PrimaryButton} from "@/app/_ui/sp";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";

// Otključaj partiju on the admin's scorepad (DECISIONS #89): a locked table of a tournament says why it is locked and
// opens again with the tournament's Vrijeme partije from now (pad.gameMinutes; nothing to pick). Only a tournament's
// table: a league table is corrected by entering games, it is never locked by an answer.

const WHY: Record<PadLock, string> = {
  no_show: "Stol je zaključan jer je prijavljen nedolazak.",
  skipped: "Stol je zaključan jer nitko nije odgovorio na upit, pa je meč preskočen.",
  time_expired: "Partija je zaključana jer je isteklo Vrijeme partije.",
  done: "Partija je odigrana do kraja i zaključana.",
};

export function UnlockBox({pad, onDone, sx}: {pad: TablePad; onDone: () => void | Promise<void>; sx?: object}) {
  const [open, setOpen] = useState(false);
  if (!pad.lock || pad.tournamentId == null) return null;
  return (
    <>
      <Box sx={{display: "flex", flexDirection: "column", gap: "10px", p: "12px 14px", borderRadius: "16px", background: color.cream, ...sx}}>
        <Box sx={{display: "flex", alignItems: "flex-start", gap: "10px", fontSize: 14, fontWeight: 600, lineHeight: 1.4, "& svg": {flex: "none", fontSize: 20, color: color.navy}}}>
          <LockRoundedIcon aria-hidden />
          {WHY[pad.lock.kind]}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={() => setOpen(true)}
          sx={{...buttonBase, height: 48, borderRadius: "14px", background: color.white, color: color.navy, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: 15.5, fontWeight: 700, border: `1.5px solid ${tint.navy[35]}`, "& svg": {fontSize: 21}, "&:active": {transform: "scale(.98)"}}}
        >
          <LockOpenRoundedIcon aria-hidden />
          Otključaj partiju
        </Box>
      </Box>
      <UnlockSheet pad={pad} open={open} onClose={() => setOpen(false)} onDone={onDone} />
    </>
  );
}

function UnlockSheet({pad, open, onClose, onDone}: {pad: TablePad; open: boolean; onClose: () => void; onDone: () => void | Promise<void>}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effects = pad.lock ? unlockEffects(pad.lock.kind, {absent: pad.lock.absent, both: [pad.team1.name, pad.team2.name]}, pad.gameMinutes) : [];

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlockTableAPI(pad.roundId);
      await onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stol nije otključan.");
    }
    setBusy(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Otključaj partiju" eyebrow={`Stol ${pad.table ?? "–"}${pad.roundNumber ? ` · Kolo ${pad.roundNumber}` : ""}`} busy={busy} closable>
      <Box sx={{display: "flex", flexDirection: "column", gap: "14px"}}>
        <Box component="ul" sx={{listStyle: "none", m: 0, p: 0, borderRadius: "16px", background: color.paper, display: "flex", flexDirection: "column"}}>
          {effects.map((text, i) => (
            <Box component="li" key={text} sx={{display: "flex", gap: "10px", p: "11px 13px", borderTop: i ? `1px solid ${color.line}` : "none", fontSize: 14, lineHeight: 1.45, color: color.ink, "& svg": {flex: "none", fontSize: 19, color: color.green, mt: "1px"}}}>
              <CheckRoundedIcon aria-hidden />
              <span>{text}</span>
            </Box>
          ))}
        </Box>
        <Box sx={{display: "flex", gap: "10px", p: "12px 14px", borderRadius: "16px", background: tint.gold[16], color: color.ink, fontSize: 14, lineHeight: 1.45, "& svg": {fontSize: 20, flex: "none", mt: "1px"}}}>
          <WarningRoundedIcon aria-hidden />
          <span>{UNLOCK_KOLO_WARNING}</span>
        </Box>
        {error && <ErrorNote>{error}</ErrorNote>}
        <PrimaryButton icon={<LockOpenRoundedIcon />} onClick={unlock} loading={busy} sx={{height: 56, fontSize: 16, borderRadius: "16px"}}>
          Otključaj
        </PrimaryButton>
      </Box>
    </BottomSheet>
  );
}
