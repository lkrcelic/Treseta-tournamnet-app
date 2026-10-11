// Burza igrača text: the ad cards, the Home card and how long ago an ad was published. Framework free so it can be
// unit tested.
import type {BurzaKind, BurzaPost} from "@/app/_interfaces/burza";
import {nightLabel} from "@/app/_lib/nights";
import {plural} from "./text";

// The tag on each ad: label, background, text color
export const KIND_TAG: Record<BurzaKind, {label: string; bg: string; ink: string}> = {
  SUBSTITUTE: {label: "Treba zamjena", bg: "rgba(188,71,73,.1)", ink: "#A63B3D"},
  PARTNER: {label: "Traži partnera", bg: "rgba(60,74,103,.1)", ink: "#3C4A67"},
  AVAILABLE: {label: "Dostupan", bg: "rgba(56,102,65,.12)", ink: "#386641"},
};

// "4 ekipe traže igrača", "1 ekipa traži igrača", "5 ekipa traži igrača"
export function teamsLooking(n: number): string {
  return `${n} ${plural(n, "ekipa traži", "ekipe traže", "ekipa traži")} igrača`;
}

// "8 oglasa", "1 oglas"
export function adCount(n: number): string {
  return `${n} ${plural(n, "oglas", "oglasa", "oglasa")}`;
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

// The average rating in tens ("rejting ekipe oko 1550"), null without ratings
export function ratingInTens(ratings: number[]): number | null {
  if (!ratings.length) return null;
  return Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length / 10) * 10;
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

// The line under the headline: "Liga Četvrtak · rejting 1550", "Za zamjenu i novog partnera"
export function postSub(p: BurzaPost): string {
  if (p.kind === "AVAILABLE") return `Za ${availableAs(p.as_substitute, p.as_partner)}`;
  const rating = p.kind === "SUBSTITUTE" ? p.team_rating : p.rating;
  return [p.league?.name, rating != null && `rejting ${rating}`].filter(Boolean).join(" · ");
}

// The ad's text in the list
export function postBody(p: BurzaPost): string {
  if (p.kind === "SUBSTITUTE") {
    return [p.out_player && `Umjesto: ${p.out_player}`, p.team_rating != null && `rejting ekipe oko ${p.team_rating}`].filter(Boolean).join(" · ");
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
      {label: "Umjesto", value: p.out_player ?? "—"},
      {label: "Rejting ekipe", value: p.team_rating != null ? `oko ${p.team_rating}` : "—"},
    ];
  }
  if (p.kind === "PARTNER") return [{label: "Liga", value: p.league?.name ?? "—"}, {label: "Rejting", value: rating}];
  return [{label: "Dostupan za", value: availableAs(p.as_substitute, p.as_partner)}, {label: "Rejting", value: rating}];
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
