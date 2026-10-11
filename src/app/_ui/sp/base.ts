import {color, font} from "@/app/_styles/tokens";
import type {SxProps, Theme} from "@mui/material";

// Plain <button> reset shared by every Scorepad button: no UA chrome, visible keyboard focus, press feedback.
export const buttonBase = {
  appearance: "none",
  border: "none",
  margin: 0,
  padding: 0,
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  textAlign: "center",
  WebkitTapHighlightColor: "transparent",
  "&:focus-visible": {outline: `3px solid ${color.navy}`, outlineOffset: "2px"},
  "&:disabled": {cursor: "default"},
} as const;

export const eyebrowSx = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: color.muted,
} as const;

export const displaySx = {
  fontFamily: font.display,
  fontWeight: 800,
  letterSpacing: "-.02em",
  lineHeight: 1.02,
  margin: 0,
} as const;

export const cardSx = {
  background: color.card,
  borderRadius: "22px",
  boxShadow: "0 1px 3px rgba(31,36,51,.06)",
} as const;

export const tabular = {fontVariantNumeric: "tabular-nums"} as const;

export const ellipsis = {whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"} as const;

// merges sx values the way MUI expects (arrays are flattened by MUI)
export function mergeSx(...parts: (SxProps<Theme> | undefined | false)[]): SxProps<Theme> {
  return parts.filter(Boolean).flatMap((p) => (Array.isArray(p) ? p : [p])) as SxProps<Theme>;
}
