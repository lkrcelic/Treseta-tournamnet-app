// Burza igrača text: the ad cards, the Home card and how long ago an ad was published. Framework free so it can be
// unit tested.
import type {BurzaKind, BurzaPost, BurzaStatus, MyBurzaPost, MyLeague} from "@/app/_interfaces/burza";
import {leagueDateString} from "@/app/_lib/dates";
import {nightLabel} from "@/app/_lib/nights";
import {count, NOUN, plural} from "./text";
import {color, tint} from "@/app/_styles/tokens";

// The tag on each ad: label, background, text color
export const KIND_TAG: Record<BurzaKind, {label: string; bg: string; ink: string}> = {
  SUBSTITUTE: {label: "Treba zamjena", bg: tint.red[10], ink: color.red},
  PARTNER: {label: "Traži partnera", bg: tint.navy[10], ink: color.navy},
  AVAILABLE: {label: "Dostupan", bg: tint.green[12], ink: color.green},
};

// "4 ekipe traže igrača", "1 ekipa traži igrača", "5 ekipa traži igrača"
export function teamsLooking(n: number): string {
  return `${count(n, NOUN.ekipaTraži)} igrača`;
}

// "8 oglasa", "1 oglas"
export function adCount(n: number): string {
  return count(n, NOUN.oglas);
}

// The teams looking for a substitute, as Početna's Burza card and Burza's Zamjene count them (DECISIONS #29): other
// teams only (not the viewer's own ads), each team once however many nights it asks for, in the order of the list.
// With a night, only the teams asking for that night.
export function teamsAsking(posts: BurzaPost[], night: string | null = null): {id: number; name: string}[] {
  const teams = new Map<number, string>();
  for (const p of posts) {
    if (p.kind !== "SUBSTITUTE" || p.mine || !p.team || (night != null && p.night !== night)) continue;
    if (!teams.has(p.team.id)) teams.set(p.team.id, p.team.name);
  }
  return Array.from(teams, ([id, name]) => ({id, name}));
}

// "Slavonci, Kvarnerci i još 2", "Slavonci i Kvarnerci", "Slavonci"
export function namesAndMore(names: string[], shown = 2): string {
  if (names.length <= shown) return names.length === 2 ? `${names[0]} i ${names[1]}` : names.join(", ");
  return `${names.slice(0, shown).join(", ")} i još ${names.length - shown}`;
}

// "zamjenu", "novog partnera", "zamjenu i novog partnera"
export function availableAs(asSubstitute: boolean, asPartner: boolean): string {
  return [asSubstitute && "zamjenu", asPartner && "novog partnera"].filter(Boolean).join(" i ");
}

// "upravo", "prije 5 min", "prije 2 h", "jučer", "prije 3 dana", "prije tjedan dana", "prije 2 tjedna", "prije mjesec dana"
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "upravo";
  if (minutes < 60) return `prije ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `prije ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "jučer";
  if (days < 7) return `prije ${days} dana`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? "prije tjedan dana" : `prije ${weeks} tjedna`;
  const months = Math.floor(days / 30);
  return months === 1 ? "prije mjesec dana" : `prije ${months} ${plural(months, "mjesec", "mjeseca", "mjeseci")}`;
}

// The ad's headline in the list: the team that needs a player, or the player
export function postTitle(p: BurzaPost): string {
  return p.kind === "SUBSTITUTE" ? p.team?.name ?? "Ekipa" : p.author.name;
}

// The line under the headline: "Liga Četvrtak", "Liga Četvrtak · rejting 1550", "Za zamjenu i novog partnera"
export function postSub(p: BurzaPost): string {
  if (p.kind === "AVAILABLE") return `Za ${availableAs(p.as_substitute, p.as_partner)}`;
  // a substitute ad gives the suigrač's rating in its text
  const rating = p.kind === "SUBSTITUTE" ? null : p.rating;
  return [p.league?.name, rating != null && `rejting ${rating}`].filter(Boolean).join(" · ");
}

// The ad's text in the list
export function postBody(p: BurzaPost): string {
  if (p.kind === "SUBSTITUTE") {
    return [p.with_player && `Suigrač: ${p.with_player}`, p.with_rating != null && `rejting ${p.with_rating}`].filter(Boolean).join(" · ");
  }
  if (p.kind === "PARTNER") return p.note || "Javi se ako i ti tražiš partnera.";
  return [p.note || "Javi se ako trebate igrača.", p.rating != null && `rejting ${p.rating}`].filter(Boolean).join(" · ");
}

// The ad's headline on its own page: "Ekipa Slavonci traži zamjenu" (a team name can be anything, "Barcelona" or
// "Mujo i Haso", so it isn't declined or given a verb of its own)
export function postHeadline(p: BurzaPost): string {
  return p.kind === "SUBSTITUTE" ? `Ekipa ${postTitle(p)} traži zamjenu` : p.author.name;
}

// The rows under the headline on the ad's page
export function postDetails(p: BurzaPost): {label: string; value: string}[] {
  const rating = p.rating != null ? String(p.rating) : "Još nema";
  if (p.kind === "SUBSTITUTE") {
    return [
      {label: "Liga", value: p.league?.name ?? "—"},
      {label: "Večer", value: p.night ? nightLabel(p.night) : "—"},
      {label: "Suigrač", value: p.with_player ?? "—"},
      {label: "Rejting suigrača", value: p.with_rating != null ? String(p.with_rating) : p.with_player ? "Još nema" : "—"},
    ];
  }
  if (p.kind === "PARTNER") return [{label: "Liga", value: p.league?.name ?? "—"}, {label: "Rejting", value: rating}];
  return [{label: "Dostupan za", value: availableAs(p.as_substitute, p.as_partner)}, {label: "Rejting", value: rating}];
}

// Trebam zamjenu · Tko traži zamjenu?: the team's players the substitute can play with, the logged-in player first
// (picked at first: mostly they ask for themselves), then the teammates who aren't deactivated
export function substituteRoster<P extends MyLeague["players"][number]>(players: P[]): P[] {
  return players.filter((p) => p.me || p.active).sort((a, b) => Number(b.me) - Number(a.me));
}

// Who to call: "Hrvoje Lovrić · Slavonci"
export function postContact(p: BurzaPost): string {
  return p.kind === "SUBSTITUTE" && p.team ? `${p.author.name} · ${p.team.name}` : p.author.name;
}

// The nights that have substitute ads, in date order (Burza · Zamjene date arrows)
export function substituteNights(posts: BurzaPost[]): string[] {
  return Array.from(new Set(posts.filter((p) => p.kind === "SUBSTITUTE" && p.night).map((p) => p.night!))).sort();
}

// "Taj dan igraš za ekipu Dalmatinci" (the name stays as it is, see postHeadline)
export function busyLine(team: string): string {
  return `Taj dan igraš za ekipu ${team}`;
}

// Moji oglasi

// The status pill on each of the player's ads: label, background, text and dot colour
export const STATUS_PILL: Record<BurzaStatus, {label: string; bg: string; ink: string}> = {
  ACTIVE: {label: "Aktivan", bg: tint.green[12], ink: color.green},
  EXPIRED: {label: "Istekao", bg: color.lineFill, ink: color.muted},
  CLOSED: {label: "Zatvoren", bg: color.lineFill, ink: color.muted},
};

// "29. 9." for a date (YYYY-MM-DD) or a moment (an ISO timestamp, taken in league time)
export function dayMonth(iso: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : leagueDateString(new Date(iso));
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${Number(m[2])}. ${Number(m[1])}.` : iso;
}

// The headline of the player's own ad: "Ekipa Dalmatinci traži zamjenu", "Tražim partnera", "Dostupan sam"
export function myPostTitle(p: BurzaPost): string {
  if (p.kind === "SUBSTITUTE") return postHeadline(p);
  return p.kind === "PARTNER" ? "Tražim partnera" : "Dostupan sam";
}

// The line under it: "Liga Utorak · uto 13. 10. · suigrač: Ivan Perić", "Liga Četvrtak", "Za zamjenu i novog partnera"
export function myPostSub(p: BurzaPost): string {
  if (p.kind === "SUBSTITUTE") {
    return [p.league?.name, p.night && nightLabel(p.night), p.with_player && `suigrač: ${p.with_player}`].filter(Boolean).join(" · ");
  }
  if (p.kind === "PARTNER") return p.league?.name ?? "";
  return `Za ${availableAs(p.as_substitute, p.as_partner)}`;
}

// What was just done to an ad on Moji oglasi (until the list is loaded again): closed, published again, or found
// already up when another ad like it was published again
export type MyPostChange = "closed" | "reposted" | "already";

// When the ad closes, or when and why it did: "Zatvara se sam nakon večeri, uto 13. 10.", "Aktivan dok ga ne
// zatvoriš", "Istekao nakon večeri 29. 9.", "Zatvoren 2. 10."; right after a change "Zatvoren upravo" /
// "Objavljeno ponovno" / "Već imaš ovakav oglas" (a change the ad's status no longer agrees with is left out)
export function expiryLine(p: MyBurzaPost, today: string, change?: MyPostChange): string {
  const active = p.status === "ACTIVE";
  if (change === "closed" && !active) return "Zatvoren upravo";
  if (change === "reposted" && active) return "Objavljeno ponovno";
  if (change === "already" && active) return "Već imaš ovakav oglas";
  if (p.status === "CLOSED") return p.closed_at ? `Zatvoren ${dayMonth(p.closed_at)}` : "Zatvoren";
  if (p.status === "EXPIRED") {
    if (p.kind === "PARTNER") return p.ends_on ? `Istekao kad je liga završila ${dayMonth(p.ends_on)}` : "Istekao kad je liga završila";
    // a night still ahead is no longer one of the league's nights
    if (p.night && p.night >= today) return "Istekao: večer je uklonjena iz rasporeda";
    return p.night ? `Istekao nakon večeri ${dayMonth(p.night)}` : "Istekao";
  }
  if (p.kind === "SUBSTITUTE" && p.night) return `Zatvara se sam nakon večeri, ${nightLabel(p.night)}`;
  if (p.kind === "PARTNER" && p.ends_on) return `Zatvara se sam kad liga završi, ${dayMonth(p.ends_on)}`;
  return "Aktivan dok ga ne zatvoriš";
}

// Why a past ad can't be published again, shown where "Objavi ponovno" would be: a partner ad whose league has ended
export function repostBlocked(p: MyBurzaPost, today: string): string | null {
  return p.status !== "ACTIVE" && p.kind === "PARTNER" && p.ends_on != null && p.ends_on < today ? "Liga je završila" : null;
}

// "Aktivni · 2", "Prošli · 0"
export function myTabLabel(tab: "active" | "past", n: number): string {
  return `${tab === "active" ? "Aktivni" : "Prošli"} · ${n}`;
}

// "Objavi ponovno" opens the ad's form instead of putting it straight back up: a substitute ad whose night is gone
// (a new night is picked there), and an availability ad without a phone number (Burza wouldn't list it)
export function repostOpensForm(p: MyBurzaPost): boolean {
  return (p.kind === "SUBSTITUTE" && p.night_gone) || (p.kind === "AVAILABLE" && !p.phone);
}

// That form, filled in from the ad: its league, team, player and note in the address, and repost=<id>, from which the
// form takes the ad's phone number (it isn't put in the address) and an availability ad's choices
export function repostFormHref(p: MyBurzaPost): string {
  const q = new URLSearchParams({repost: String(p.id)});
  if (p.kind === "AVAILABLE") return `/burza/novi/dostupan?${q.toString()}`;
  if (p.league) q.set("league", String(p.league.id));
  if (p.team) q.set("team", String(p.team.id));
  if (p.with_player_id != null) q.set("with", String(p.with_player_id));
  if (p.note) q.set("note", p.note);
  return `/burza/novi/zamjena?${q.toString()}`;
}
