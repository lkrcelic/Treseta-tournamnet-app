// Design tokens of the "Scorepad" look (Claude Design: Piatnik Bela Liga app refresh).
// Every screen takes its colours, type and spacing from here: no hex or rgba() values anywhere else
// (`_lib/__tests__/tokens.test.ts` checks it).

// Alpha scales: the only translucent colours of the app, keyed by percent (tint.navy[8] = navy at 8%).
export const tint = {
  navy: {
    4: "rgba(60,74,103,.04)",
    7: "rgba(60,74,103,.07)",
    8: "rgba(60,74,103,.08)",
    10: "rgba(60,74,103,.1)",
    12: "rgba(60,74,103,.12)",
    18: "rgba(60,74,103,.18)",
    20: "rgba(60,74,103,.2)",
    22: "rgba(60,74,103,.22)",
    25: "rgba(60,74,103,.25)",
    30: "rgba(60,74,103,.3)",
    35: "rgba(60,74,103,.35)",
    40: "rgba(60,74,103,.4)",
    92: "rgba(60,74,103,.92)",
  },
  red: {
    6: "rgba(188,71,73,.06)",
    8: "rgba(188,71,73,.08)",
    10: "rgba(188,71,73,.1)",
    12: "rgba(188,71,73,.12)",
    13: "rgba(188,71,73,.13)",
    15: "rgba(188,71,73,.15)",
    20: "rgba(188,71,73,.2)",
    35: "rgba(188,71,73,.35)",
    45: "rgba(188,71,73,.45)",
  },
  green: {
    9: "rgba(56,102,65,.09)",
    12: "rgba(56,102,65,.12)",
    13: "rgba(56,102,65,.13)",
    14: "rgba(56,102,65,.14)",
    15: "rgba(56,102,65,.15)",
  },
  gold: {16: "rgba(212,168,44,.16)"},
  // cream on the navy cards
  creamOnNavy: {
    16: "rgba(237,224,191,.16)",
    24: "rgba(237,224,191,.24)",
    45: "rgba(237,224,191,.45)",
    55: "rgba(237,224,191,.55)",
  },
  white: {
    8: "rgba(255,255,255,.08)",
    14: "rgba(255,255,255,.14)",
    25: "rgba(255,255,255,.25)",
    55: "rgba(255,255,255,.55)",
    62: "rgba(255,255,255,.62)",
    70: "rgba(255,255,255,.7)",
  },
  // backdrops behind sheets, dialogs and the nav drawer
  scrim: {
    28: "rgba(21,24,31,.28)",
    32: "rgba(21,24,31,.32)",
    42: "rgba(21,24,31,.42)",
  },
} as const;

// The palette of the handoff (§1); nothing else.
export const color = {
  navy: "#3C4A67", // primary actions, labels
  ink: "#1F2433", // main text
  ink2: "#4A5062", // secondary text
  muted: "#5E6577", // captions, headers, small text
  faint: "#8A8F9C", // idle icons, placeholders, decorative counts (not for text that must be read)
  paper: "#F5F2EA", // app background
  paper2: "#FAF8F3", // inset rows, table headers, input fill
  lineFill: "#EFEBE1", // segmented tracks, rank circles, pressed keys
  cream: "#EDE0BF", // header cards
  cream2: "#F7F0DC", // "my row" highlight
  rule: "#B8B2A4", // dashed chart line
  hairline: "#D8D4CA", // grab handles, avatar bubbles
  green: "#386641", // team 1, positive change
  red: "#BC4749", // team 2, negative change, destructive, live
  white: "#FFFFFF", // cards; text and icons on navy, green and red
  medal: ["#B8901C", "#8A9099", "#A0643A"],
  medalBg: ["rgba(212,168,44,.26)", "rgba(160,166,176,.26)", "rgba(176,112,64,.24)"],
  // lines and borders (navy alphas)
  divider: tint.navy[7], // between table rows
  line: tint.navy[8], // card hairlines, hover
  border: tint.navy[18], // inputs
  borderControl: tint.navy[20], // 1.5px control borders, a switch that is off
  borderStrong: tint.navy[30],
} as const;

// Left team is always green, right team red (the left side is the viewer's own team).
export const teamColor = [color.green, color.red] as const;
export const teamTint = [tint.green[13], tint.red[13]] as const;
export const teamTrack = [tint.green[15], tint.red[15]] as const;
// the team dots on the navy Start Game card: the board's green and red, lightened to stand out on navy
export const teamOnNavy = ["#6FA67A", "#E07A7C"] as const;

// Third-party colours that must stay as their owners define them.
export const brand = {
  google: {
    blue: "#4285F4",
    red: "#EA4335",
    yellow: "#FBBC05",
    green: "#34A853",
    border: "#747775",
    text: "#1F1F1F",
    hover: "#F8F9FA",
    hoverShadow: "0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)",
  },
} as const;

// The system blue of iOS and Android, used where the install guide imitates their screens.
export const platform = {ios: "#0A84FF", android: "#0B57D0"} as const;

export const font = {
  display: "'Bricolage Grotesque', 'Instrument Sans', system-ui, sans-serif",
  body: "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

export const shadow = {
  card: "0 1px 3px rgba(31,36,51,.06)",
  raised: "0 1px 3px rgba(31,36,51,.08)",
  pill: "0 1px 3px rgba(31,36,51,.1)", // header buttons and pills, the selected tab of a track
  segment: "0 1px 3px rgba(31,36,51,.12)", // the selected button of a segmented filter
  cardHover: "0 4px 14px rgba(31,36,51,.1)",
  action: "0 10px 24px rgba(31,36,51,.18)",
  fab: "0 12px 28px rgba(31,36,51,.3)",
  hero: "0 14px 30px rgba(60,74,103,.3)",
  popover: "0 18px 50px rgba(21,24,31,.22), 0 0 0 1px rgba(60,74,103,.08)",
  sheet: "0 -12px 40px rgba(21,24,31,.18)",
  dialog: "0 30px 80px rgba(21,24,31,.3)",
  drawer: "16px 0 48px rgba(21,24,31,.22)",
  panel: "0 18px 50px rgba(21,24,31,.25)",
  tooltip: "0 10px 30px rgba(21,24,31,.25)",
  arrow: "0 6px 16px rgba(21,24,31,.25)", // the round scroll arrows over a long list
  knob: "0 1px 3px rgba(21,24,31,.25)", // the knob of a switch
  sticky: "0 6px 12px -8px rgba(31,36,51,.25)", // under a sticky header once the list scrolls
  focus: `0 0 0 3px ${tint.navy[18]}`, // focus ring of an input
  // my team: a navy bar on the left of a row, a navy ring around a podium card; selectRing marks the selected row
  // and the player's own table card
  mineBar: `inset 4px 0 0 ${color.navy}`,
  mineRing: `inset 0 0 0 2.5px ${color.navy}`,
  selectRing: `inset 0 0 0 2px ${color.navy}`,
} as const;

export const radius = {
  md: "14px",
  card: "22px",
} as const;

export const ease = "cubic-bezier(.2,.8,.2,1)";

// Desktop layout (sidebar drawer, side-by-side panels) starts here; below it the phone layout is used.
export const DESKTOP_MIN_WIDTH = 1024;
