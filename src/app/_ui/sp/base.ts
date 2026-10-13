import {color, font, radius, shadow} from "@/app/_styles/tokens";
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
  background: color.white,
  borderRadius: radius.card,
  boxShadow: shadow.card,
} as const;

// The keyboard focus ring of a list row (or a card) that is a link: inside it, so the next row and the card's edge
// don't cut it. Spread it into the row's `&:has(a:focus-visible)` (or the link's own `&:focus-visible`).
export const rowFocus = {outline: `3px solid ${color.navy}`, outlineOffset: "-3px"} as const;

// A link stretched over its row or card (the row needs `position: relative`): the link's name is what a screen reader
// announces, and the whole row takes the click
export const stretchedArea = {"&::after": {content: '""', position: "absolute", inset: 0}} as const;

// Scrolls `box` so that `row` (inside it) sits in the middle of what is visible of it; pinned = the height of a sticky
// block at the top of the list (column labels, a pinned podium), which hides what is under it
export function scrollIntoMiddle(row: HTMLElement, box: HTMLElement, pinned = 0) {
  const r = row.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const top = b.top + pinned;
  box.scrollTop += r.top - top - (b.bottom - top - r.height) / 2;
}

export const tabular = {fontVariantNumeric: "tabular-nums"} as const;

// Desktop window sizes below the designed 1440×900, for sx keys (and useShortWindow): a window under 800 px high gets
// the compact headers, header cards and scorepad panels; one under 1280 px wide narrows the fixed side columns (both
// are true for a 1024×640 laptop window)
export const SHORT_WINDOW = "@media (max-height: 799.98px)";
export const NARROW_DESKTOP = "@media (max-width: 1279.98px)";

// Text for screen readers only. The sizes are strings on purpose: in sx a bare 1 is 100% (a full-width absolute box
// that made the phone Rejting detail scroll sideways).
export const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

export const ellipsis = {whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"} as const;

// merges sx values the way MUI expects (arrays are flattened by MUI)
export function mergeSx(...parts: (SxProps<Theme> | undefined | false)[]): SxProps<Theme> {
  return parts.filter(Boolean).flatMap((p) => (Array.isArray(p) ? p : [p])) as SxProps<Theme>;
}
