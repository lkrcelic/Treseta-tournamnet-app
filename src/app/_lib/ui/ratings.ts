// Formatting and chart geometry for the ratings page. Framework free so they can be unit tested.
import {MU0} from "@/app/_lib/rating/glicko2";

// +18, −12 (a real minus sign), 0
export function formatChange(change: number | null | undefined): string {
  if (change == null) return "—";
  return change > 0 ? `+${change}` : change < 0 ? `−${Math.abs(change)}` : "0";
}

// green up, red down, grey otherwise
export function changeTone(change: number | null | undefined): "up" | "down" | "flat" {
  return change == null || change === 0 ? "flat" : change > 0 ? "up" : "down";
}

// "1 kolo", "21 kolo", "2 kola", "11 kola", "0 kola"
export function roundsLabel(n: number): string {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "kolo" : "kola"}`;
}

// "2026-02-17" -> "17.02."
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

// a night's matches: "5:1", and whether it went well
export function nightResult(won: number, lost: number): {label: string; tone: "up" | "down" | "flat"} {
  return {label: `${won}:${lost}`, tone: won > lost ? "up" : won < lost ? "down" : "flat"};
}

export type ChartGeometry = {line: string; area: string; baseY: number; end: {x: number; y: number}};

/**
 * The "Kroz večeri" line: the start (1500) and the rating after each night, scaled into width × height with a
 * little room above and below; area fills under the line, baseY is the 1500 line.
 */
export function ratingChart(ratings: number[], width: number, height: number, pad = 14): ChartGeometry {
  const values = [MU0, ...ratings];
  const lo = Math.min(...values) - pad;
  const hi = Math.max(...values) + pad;
  const round = (n: number) => Math.round(n * 10) / 10;
  const x = (i: number) => round(values.length > 1 ? (i / (values.length - 1)) * width : width / 2);
  const y = (v: number) => round(height - ((v - lo) / (hi - lo)) * height);
  const points = values.map((v, i) => `${x(i)} ${y(v)}`);
  return {
    line: `M${points.join(" L")}`,
    area: `M0 ${height} L${points.join(" L")} L${width} ${height} Z`,
    baseY: y(MU0),
    end: {x: x(values.length - 1), y: y(values[values.length - 1])},
  };
}

// the explanations of the list's columns ("Što znače stupci?") and of the rating itself
export const RATING_COLUMNS: [string, string][] = [
  ["#", "Mjesto na listi, od najvišeg rejtinga."],
  ["Igrač", "Ime igrača i ekipa za koju igra."],
  ["Rejting", "Tvoja snaga u bodovima. Svi počinju od 1500; pobjede ga dižu, porazi spuštaju. Pobjeda protiv jače ekipe vrijedi više."],
  ["Promjena", "Koliko se rejting promijenio zadnju večer kad si igrao."],
  ["Kola", "Koliko si kola odigrao. Uz malo kola rejting je još privremen."],
  ["Privremeno", "Igrač je odigrao malo kola, pa mu se rejting još brzo mijenja."],
];

export const RATING_HOW = [
  "Svi počinju od 1500.",
  "Pobjeda diže rejting, poraz ga spušta; protiv jače ekipe pobjeda vrijedi više.",
  "Novi igrači se brže pomiču dok im se rejting ne ustali.",
  "Računa se samo igračima koji su odabrani da igraju kolo.",
];
