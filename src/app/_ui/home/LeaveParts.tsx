"use client";

import {color, shadow, tint} from "@/app/_styles/tokens";
import {buttonBase, ConfirmSheet} from "@/app/_ui/sp";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import {Box} from "@mui/material";
import React, {useState} from "react";

// Treseta's copy of the league's part of Bela's _ui/tournaments/DayParts.tsx (tournaments aren't copied here).

// Odlazimo and Ipak otkazujemo: a real button, outlined in cream, so the team sees how to leave or cancel
export const leaveButton = {
  ...buttonBase,
  height: 48,
  borderRadius: "14px",
  border: `1.5px solid ${color.cream}`,
  color: color.cream,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: 16,
  fontWeight: 700,
  transition: "background 160ms ease",
  "&:hover": {background: tint.creamOnNavy[16]},
  "& svg": {fontSize: 20},
  "&:disabled": {opacity: 0.45},
} as const;

// Odlazimo under Započni igru on Početna: the cards' outlined cream button on navy, so the team playing a table still
// sees how to leave; it asks first (title, text: what leaving means there)
export function LeaveRow({title, text, onLeave}: {title: string; text: string; onLeave: () => Promise<void>}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await onLeave();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nije spremljeno.");
    }
    setBusy(false);
  };
  return (
    <>
      <Box component="button" type="button" onClick={() => setOpen(true)} sx={{...leaveButton, flex: "none", height: 52, background: color.navy, boxShadow: shadow.card, "&:hover": {background: color.navy}}}>
        <LogoutRoundedIcon aria-hidden />
        Odlazimo
      </Box>
      <ConfirmSheet open={open} onClose={() => setOpen(false)} onConfirm={leave} title={title} text={text} action="Odlazimo" icon={<LogoutRoundedIcon />} busy={busy} error={error} />
    </>
  );
}
