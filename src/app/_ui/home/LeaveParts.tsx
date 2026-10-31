"use client";

import {color, tint} from "@/app/_styles/tokens";
import {buttonBase} from "@/app/_ui/sp";

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
