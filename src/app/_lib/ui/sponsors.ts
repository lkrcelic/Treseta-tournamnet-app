import {SponsorAdmin, SponsorCounts} from "@/app/_interfaces/sponsor";
import {NOUN, plural} from "@/app/_lib/ui/text";

// What the sponsor screens show, framework free (checked by __tests__/sponsors.test.ts)

// A logo's tile at a given height: every logo in the same rounded rectangle (1.9 : 1), white, dark or with nothing
// under the logo (its Pozadina loga), with the logo fitted inside it whatever its own shape
export const TILE_RATIO = 1.9;
export function logoTile(height: number): {width: number; height: number; padY: number; padX: number; radius: number} {
  return {width: Math.round(height * TILE_RATIO), height, padY: Math.round(height * 0.14), padX: Math.round(height * 0.2), radius: Math.round(height * 0.26)};
}

// "1 210": a space between thousands, as the design writes counts (a no-break space, so it doesn't wrap)
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// "1 210 prikaza · 22 otvaranja" (Upravljanje ligom · Sponzori on the phone); short: "1 210 prikaza · 22 otv." on the
// computer's narrower column
export function countsLabel(c: SponsorCounts | undefined, short = false): string {
  const views = c?.views ?? 0;
  const clicks = c?.clicks ?? 0;
  const viewsText = `${groupDigits(views)} ${plural(views, ...NOUN.prikaz)}`;
  return `${viewsText} · ${groupDigits(clicks)} ${short ? "otv." : plural(clicks, ...NOUN.otvaranje)}`;
}

// The leagues that show a sponsor, on the admin's list: "Liga Srijeda · Liga Utorak" (the computer separates them with
// commas), or that none does
export const NO_LEAGUE = "Nije ni u jednoj ligi";
export function leaguesLabel(leagues: {name: string}[], separator = " · "): string {
  return leagues.length ? leagues.map((l) => l.name).join(separator) : NO_LEAGUE;
}

// Under a sponsor's name in a league's picking list: the other leagues that show it ("Još u: Liga Utorak"), else its
// message, else whether it has a link
export function pickSub(s: Pick<SponsorAdmin, "leagues" | "message" | "url">, leagueId: number): string {
  const others = s.leagues.filter((l) => l.id !== leagueId);
  if (others.length) return `Još u: ${others.map((l) => l.name).join(", ")}`;
  return s.message || (s.url ? "link" : "bez linka");
}

// Under a sponsor's name in a list: its message, else whether it has a link
export function sponsorSub(s: {message: string; url: string | null}): string {
  return s.message || (s.url ? "link" : "bez linka");
}

// "Macaklin Social Club se briše s popisa sponzora i iz liga Liga Srijeda, Liga Utorak. Brojke prikaza i otvaranja se
// brišu."
export function deleteSponsorText(name: string, leagues: {name: string}[]): string {
  const from = leagues.length === 0 ? "" : leagues.length === 1 ? ` i iz lige ${leagues[0].name}` : ` i iz liga ${leagues.map((l) => l.name).join(", ")}`;
  return `${name} se briše s popisa sponzora${from}. Brojke prikaza i otvaranja se brišu.`;
}

// The sliding band repeats its logos until one round is at least as wide as the band, then slides by one round; the
// round goes twice in a row so the end meets the start without a gap
export function bandRounds(bandWidth: number, listWidth: number): number {
  if (listWidth <= 0) return 1;
  return Math.max(1, Math.ceil(bandWidth / listWidth));
}

// Slow and steady (the design's 12 px a second): seconds for the band to slide by one round
export const BAND_SPEED = 12;
export function bandSeconds(roundWidth: number): number {
  return Math.max(8, Math.round(roundWidth / BAND_SPEED));
}

// A list with one item moved (the drag handle of a league's sponsors)
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}
