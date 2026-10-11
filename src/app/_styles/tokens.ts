// Design tokens of the "Scorepad" look (Claude Design: Piatnik Bela Liga app refresh).
// Every new screen takes its colors, type and spacing from here so the look stays consistent.

export const color = {
  paper: "#F5F2EA", // page background
  paperDeep: "#EFEBE1", // nav drawer
  paperSoft: "#F9F7F2", // input fill, list header on phone
  tableHead: "#FAF8F3", // desktop table header / input fill
  card: "#FFFFFF",
  ink: "#1F2433",
  inkSoft: "#4A5062",
  muted: "#5E6577",
  // readable small text (5.2:1 on white, 4.6:1 on paper); the design's #8A8F9C is kept for placeholders only
  faint: "#686D7D",
  placeholder: "#8A8F9C",
  navy: "#3C4A67",
  cream: "#EDE0BF",
  creamSoft: "#FBF6E8", // my table's card in a round
  mine: "#F7F0DC", // my team's row in the standings
  pressed: "#F3EEE1",
  green: "#386641",
  red: "#BC4749",
  live: "#BC4749",
  scrim: "rgba(21,24,31,.35)",
  line: "rgba(60,74,103,.08)",
  lineStrong: "rgba(60,74,103,.14)",
  border: "rgba(60,74,103,.18)",
  borderStrong: "rgba(60,74,103,.3)",
  switchOff: "rgba(60,74,103,.2)",
  hover: "rgba(60,74,103,.08)",
  medal: ["#B8901C", "#8A9099", "#A0643A"],
  medalBg: ["rgba(212,168,44,.26)", "rgba(160,166,176,.26)", "rgba(176,112,64,.24)"],
  // the top three as rows of the phone standings
  medalRow: ["rgba(212,168,44,.22)", "rgba(160,166,176,.22)", "rgba(176,112,64,.2)"],
} as const;

// Left team is always green, right team red (the left side is the viewer's own team).
export const teamColor = [color.green, color.red] as const;
export const teamTint = ["rgba(56,102,65,.13)", "rgba(188,71,73,.13)"] as const;
export const teamTrack = ["rgba(56,102,65,.15)", "rgba(188,71,73,.15)"] as const;

export const font = {
  display: "'Bricolage Grotesque', 'Instrument Sans', system-ui, sans-serif",
  body: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

export const shadow = {
  card: "0 1px 3px rgba(31,36,51,.06)",
  raised: "0 1px 3px rgba(31,36,51,.08)",
  action: "0 10px 24px rgba(31,36,51,.18)",
  hero: "0 14px 30px rgba(60,74,103,.3)",
  popover: "0 18px 40px rgba(31,36,51,.18)",
  sheet: "0 -12px 40px rgba(21,24,31,.18)",
  // my team: a navy bar on the left of a row, a navy ring around a card
  mineBar: "inset 4px 0 0 #3C4A67",
  mineRing: "inset 0 0 0 2px #3C4A67",
} as const;

export const radius = {
  sm: "10px",
  md: "14px",
  input: "16px",
  button: "18px",
  card: "22px",
  hero: "24px",
} as const;

export const ease = "cubic-bezier(.2,.8,.2,1)";

// Desktop layout (sidebar drawer, side-by-side panels) starts here; below it the phone layout is used.
export const DESKTOP_MIN_WIDTH = 1024;
