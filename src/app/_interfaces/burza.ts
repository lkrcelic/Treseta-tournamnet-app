import {DATE_FORMAT_ERROR} from "@/app/_interfaces/league";
import {isValidPhone, PHONE_ERROR} from "@/app/_lib/phone";
import {z} from "zod";

export type BurzaKind = "SUBSTITUTE" | "PARTNER" | "AVAILABLE";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, DATE_FORMAT_ERROR);
const phone = z.string().trim().refine(isValidPhone, PHONE_ERROR);
const note = (max: number) => z.string().trim().max(max, `Najviše ${max} znakova.`).default("");
const savePhone = z.boolean().default(false);

// A new ad. save_phone also saves the number on the player's profile.
export const BurzaCreateRequestValidation = z
  .discriminatedUnion("kind", [
    // Trebam zamjenu: the team, its league night and who can't play
    z.object({
      kind: z.literal("SUBSTITUTE"),
      league_id: z.number().int(),
      team_id: z.number().int(),
      night: isoDate,
      out_player_id: z.number().int(),
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
  | {kind: "SUBSTITUTE"; league_id: number; team_id: number; night: string; out_player_id: number; phone: string; note: string; save_phone: boolean}
  | {kind: "PARTNER"; league_id: number; phone: string; note: string; save_phone: boolean}
  | {kind: "AVAILABLE"; as_substitute: boolean; as_partner: boolean; phone: string; note: string; save_phone: boolean};

// what the forms send: the note and save_phone may be left out
type WithOptionalNote<T> = T extends unknown ? Omit<T, "note" | "save_phone"> & {note?: string; save_phone?: boolean} : never;
export type BurzaCreateRequest = WithOptionalNote<BurzaCreate>;

export const BurzaUpdateRequestValidation = z.object({closed: z.literal(true)});

// Profile · Dostupan sam
export const AvailabilityRequestValidation = z
  .object({available: z.boolean(), as_substitute: z.boolean().default(true), as_partner: z.boolean().default(false)})
  .refine((r) => !r.available || r.as_substitute || r.as_partner, {message: "Odaberi barem jedno.", path: ["as_substitute"]});

export type AvailabilityRequest = {available: boolean; as_substitute: boolean; as_partner: boolean};

// One ad as Burza shows it
export type BurzaPost = {
  id: number;
  kind: BurzaKind;
  created_at: string; // ISO timestamp
  // closed by its author, or its night (or league) is over
  closed: boolean;
  // who published it (the contact)
  author: {id: number; name: string};
  // SUBSTITUTE: the team that needs a player
  team: {id: number; name: string} | null;
  league: {id: number; name: string} | null;
  night: string | null; // YYYY-MM-DD
  out_player: string | null;
  // SUBSTITUTE: the team players' average rating, in tens
  team_rating: number | null;
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
  players: {id: number; name: string; rating: number; me: boolean}[];
  nights: string[]; // YYYY-MM-DD, in date order
  played: string[]; // the nights that have rounds
};

export type MySchedule = {today: string; leagues: MyLeague[]};
