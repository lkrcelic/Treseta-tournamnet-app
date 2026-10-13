// Formatting and chart geometry for Rejting, and a player's rating summary as Rejting has it (the server builds the
// Team and Player pages with it). Framework free so they can be unit tested.
import {MU0} from "@/app/_lib/rating/glicko2";
import {count, matchesQuery, NOUN} from "@/app/_lib/ui/text";
import type {RatingRow} from "@/app/_interfaces/ratings";
import type {PlayerRatingSummary} from "@/app/_interfaces/profiles";

export type RatingSummary = Omit<PlayerRatingSummary, "total">;

// Rejting shows the list a page at a time ("Učitaj još · još 42 igrača")
export const RATINGS_PAGE = 50;

/**
 * What the Rejting list shows: the players whose name matches the search (by name only, usernames are private), each
 * keeping their place on the whole list, `pages` pages of 50. Without a search the first page reaches down to the rows
 * in `keep` (the viewer's own row, the player a /ratings/<id> link opened), rounded up to ten, so they are on screen
 * without "Učitaj još". left = matches not shown yet.
 */
export function visibleRatings(
  list: readonly RatingRow[],
  query: string,
  pages: number,
  keep: readonly (number | null | undefined)[] = []
): {shown: RatingRow[]; matched: number; left: number} {
  const searching = query.trim() !== "";
  const matches = searching ? list.filter((p) => matchesQuery(p.name, query)) : list;
  // the place of the lowest kept row on the list (players with the same rating share a rank, so the place, not the rank)
  const reach = searching ? 0 : Math.max(0, ...keep.map((id) => (id == null ? 0 : list.findIndex((p) => p.id === id) + 1)));
  const first = Math.max(RATINGS_PAGE, Math.ceil(reach / 10) * 10);
  const size = first + Math.max(0, pages - 1) * RATINGS_PAGE;
  const shown = matches.slice(0, size);
  return {shown, matched: matches.length, left: matches.length - shown.length};
}

// a player's rating page, and the player of a /ratings/<id> address (null for the list itself)
export const ratingPath = (playerId: number) => `/ratings/${playerId}`;

export function ratingIdFromPath(pathname: string | null | undefined): number | null {
  const m = /^\/ratings\/(\d{1,9})\/?$/.exec(pathname ?? "");
  return m ? Number(m[1]) : null;
}

// A player's rating as Rejting shows it (the Team and Player pages). A player who isn't on the list (never on a team,
// no rated round) keeps their stored rating with no change and no rounds: Privremeno, and no place.
export function ratingSummary(list: RatingRow[], player: {id: number; rating: number}): RatingSummary {
  const row = list.find((r) => r.id === player.id);
  if (!row) return {rating: player.rating, change: null, rounds: 0, provisional: true, rank: null};
  return {rating: row.rating, change: row.change, rounds: row.rounds, provisional: row.provisional, rank: row.rank};
}

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
  return count(n, NOUN.kolo);
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
