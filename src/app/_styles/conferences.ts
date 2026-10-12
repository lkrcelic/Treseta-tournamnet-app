// The colors a league's conferences pick from (Treseta only; _lib/conferences.ts holds the rules). Each reads at least
// 3.6 : 1 on white, on the cream "my team" row and on the podium tints; none is red (the live dot is red and the same
// size) or navy (the "my team" bar).
export const CONFERENCE_COLORS: readonly {hex: string; name: string}[] = [
  {hex: "#2E6DB4", name: "plava"},
  {hex: "#C2410C", name: "narančasta"},
  {hex: "#0F766E", name: "tirkizna"},
  {hex: "#7A4BA8", name: "ljubičasta"},
  {hex: "#5F7A1F", name: "maslinasta"},
  {hex: "#8B5A2B", name: "smeđa"},
];
