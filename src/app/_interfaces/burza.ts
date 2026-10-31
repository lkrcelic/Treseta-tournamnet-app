import {DATE_FORMAT_ERROR} from "@/app/_interfaces/league";
import {MyLeagueArrival} from "@/app/_interfaces/leagueArrival";
import {isIsoDate, NightLocation} from "@/app/_lib/nights";
import {isValidPhone, PHONE_ERROR} from "@/app/_lib/phone";
import {z} from "zod";

export type BurzaKind = "SUBSTITUTE" | "PARTNER" | "AVAILABLE";

// a real day: "2026-13-45" is refused here, not by the database
const isoDate = z.string().refine(isIsoDate, DATE_FORMAT_ERROR);
const phone = z.string().trim().refine(isValidPhone, PHONE_ERROR);
const note = (max: number) => z.string().trim().max(max, `Najviše ${max} znakova.`).default("");
const savePhone = z.boolean().default(false);

// A new ad. save_phone also saves the number on the player's profile.
export const BurzaCreateRequestValidation = z
  .discriminatedUnion("kind", [
    // Trebam zamjenu: the team, its league night and the player the substitute plays with (who asks for one)
    z.object({
      kind: z.literal("SUBSTITUTE"),
      league_id: z.number().int(),
      team_id: z.number().int(),
      night: isoDate,
      with_player_id: z.number().int(),
      phone,
      note: note(500),
      save_phone: savePhone,
    }),
    // Tražim partnera: for which league
    z.object({kind: z.literal("PARTNER"), league_id: z.number().int(), phone, note: note(1000), save_phone: savePhone}),
    // Dostupan sam: as a substitute, as a new partner, or both
    z.object({kind: z.literal("AVAILABLE"), as_substitute: z.boolean(), as_partner: z.boolean(), phone, note: note(500), save_phone: savePhone}),
  ])
  .refine((r) => r.kind !== "AVAILABLE" || r.as_substitute || r.as_partner, {message: "Odaberi barem jedno.", path: ["as_substitute"]});

// spelled out: without strict mode zod infers every field as optional
export type BurzaCreate =
  | {kind: "SUBSTITUTE"; league_id: number; team_id: number; night: string; with_player_id: number; phone: string; note: string; save_phone: boolean}
  | {kind: "PARTNER"; league_id: number; phone: string; note: string; save_phone: boolean}
  | {kind: "AVAILABLE"; as_substitute: boolean; as_partner: boolean; phone: string; note: string; save_phone: boolean};

// what the forms send: the note and save_phone may be left out
type WithOptionalNote<T> = T extends unknown ? Omit<T, "note" | "save_phone"> & {note?: string; save_phone?: boolean} : never;
export type BurzaCreateRequest = WithOptionalNote<BurzaCreate>;

export const BurzaUpdateRequestValidation = z.object({closed: z.literal(true)});

// Moji oglasi · Objavi ponovno: a substitute ad whose night is gone goes up on a new night
export const BurzaRepostRequestValidation = z.object({night: isoDate.optional()});
export type BurzaRepostRequest = {night?: string};

// One ad as Burza shows it
export type BurzaPost = {
  id: number;
  kind: BurzaKind;
  created_at: string; // ISO timestamp
  // closed by its author, or its night (or league) is over
  closed: boolean;
  // who published it (the contact); photo_url: the avatar of a partner or availability ad (null = the initials)
  author: {id: number; name: string; photo_url?: string | null};
  // SUBSTITUTE: the team that needs a player; photo_url: the ad's avatar
  team: {id: number; name: string; photo_url?: string | null} | null;
  league: {id: number; name: string} | null;
  night: string | null; // YYYY-MM-DD
  // SUBSTITUTE: the player the substitute plays with ("suigrač: ...")
  with_player: string | null;
  // SUBSTITUTE: the suigrač's rating, null before their first rated round
  with_rating: number | null;
  // PARTNER / AVAILABLE: the author's rating, null before their first rated round
  rating: number | null;
  as_substitute: boolean;
  as_partner: boolean;
  note: string;
  // hidden once the ad is closed (except to its author)
  phone: string | null;
  mine: boolean;
  // the author or an admin
  can_close: boolean;
  // the viewer's team that plays on the ad's night, so the viewer can't step in
  busy_team: string | null;
};

export type BurzaList = {posts: BurzaPost[]};

// Moji oglasi: Aktivan, Istekao (its night passed or its league ended), Zatvoren (closed by hand)
export type BurzaStatus = "ACTIVE" | "EXPIRED" | "CLOSED";

// One of the player's own ads
export type MyBurzaPost = BurzaPost & {
  status: BurzaStatus;
  // YYYY-MM-DD it closes by itself: a substitute ad's night, a partner ad's league end; null for an availability ad
  ends_on: string | null;
  closed_at: string | null; // ISO timestamp, when it was closed by hand
  // a substitute ad whose night has passed or was removed: publishing it again needs a new night
  night_gone: boolean;
  // SUBSTITUTE: the player the substitute plays with, to fill in the form again for a new night
  with_player_id: number | null;
};

// Aktivni newest first; Prošli by when they ended, the latest first (at most 50)
export type MyBurzaList = {active: MyBurzaPost[]; past: MyBurzaPost[]};

// The viewer's "Dostupan sam" and profile phone
export type BurzaAvailability = {
  phone: string | null;
  available: {id: number; as_substitute: boolean; as_partner: boolean; note: string; phone: string | null} | null;
};

// A league the logged-in player plays in (through one of their teams), with its nights
export type MyLeague = {
  league_id: number;
  league_name: string;
  team_id: number;
  team_name: string;
  // the team is active in the league (inactive teams aren't signed in for rounds)
  active: boolean;
  // active: false for a deactivated player (still on the roster, but not offered in Trebam zamjenu)
  // photo_url: the avatar (null = the initials)
  players: {id: number; name: string; rating: number; me: boolean; active: boolean; photo_url?: string | null}[];
  nights: string[]; // YYYY-MM-DD, in date order
  played: string[]; // the nights that have rounds
  // when each night starts (its own time or the league's), "HH:MM"; a night without a time isn't in it
  times: Record<string, string>;
  // when each night starts gathering (Okupljanje, its own or the league's), the same way
  gatherings: Record<string, string>;
  // where each night is played (its own place or the league's); a night without a place isn't in it
  places: Record<string, NightLocation>;
  // the nights with their own Početak, Okupljanje or place (Raspored marks them)
  ownPlace: string[];
  // Potvrda dolaska tonight (Tu smo on Početna · Večeras); absent when the league doesn't play tonight with a start time
  arrival?: MyLeagueArrival;
};

export type MySchedule = {today: string; leagues: MyLeague[]};
