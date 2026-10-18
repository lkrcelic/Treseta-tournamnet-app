import {isSafeUrl} from "@/app/_lib/nights";
import {z} from "zod";

// Sponsors (Claude Design "Sponzori ekrani"): the admin's one list, each league's choice from it, and the counts.

export const SPONSOR_MESSAGE_MAX = 80;
// what the admin's browser sends at most (it shrinks a logo to LOGO_MAX_SIDE px first)
export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_MAX_SIDE = 512;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

// what is under the logo: nothing, or the black plate (for a light logo)
export const LOGO_BACKGROUNDS = ["none", "dark"] as const;
export type LogoBackground = (typeof LOGO_BACKGROUNDS)[number];

export const SPONSOR_URL_ERROR = "Link mora počinjati s https://.";
export const LOGO_REQUIRED = "Dodaj logo sponzora.";
export const LOGO_FORMAT_ERROR = "Logo mora biti PNG, JPG ili WebP.";
export const LOGO_SIZE_ERROR = "Logo može imati najviše 1 MB.";
export const SPONSOR_NOT_FOUND = "Sponzor ne postoji.";
export const UNKNOWN_SPONSORS = "Neki od odabranih sponzora više ne postoje. Osvježi popis.";

const name = z.string().trim().min(1, "Ime sponzora je obavezno.").max(100, "Ime sponzora može imati najviše 100 znakova.");
// an empty string is saved as null
const url = z.string().trim().max(500, "Link može imati najviše 500 znakova.").refine((v) => v === "" || isSafeUrl(v), SPONSOR_URL_ERROR);
const message = z.string().trim().max(SPONSOR_MESSAGE_MAX, `Poruka igračima može imati najviše ${SPONSOR_MESSAGE_MAX} znakova.`);
const side = z.number().int().min(1).max(8192);
// the logo as base64 (a data: URL is fine too) with its size in pixels, which sets the shape of its tile
const logo = z.object({data: z.string({required_error: LOGO_REQUIRED}).min(1, LOGO_REQUIRED), width: side, height: side});

export const SponsorCreateValidation = z.object({
  name,
  url: url.nullable().optional(),
  message: message.optional(),
  background: z.enum(LOGO_BACKGROUNDS).optional(),
  logo: logo.optional(),
}).refine((b) => b.logo, {message: LOGO_REQUIRED, path: ["logo"]});

// anything left out stays as it is
export const SponsorUpdateValidation = z
  .object({name: name.optional(), url: url.nullable().optional(), message: message.optional(), background: z.enum(LOGO_BACKGROUNDS).optional(), logo: logo.optional()})
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Nema promjene.");

// a league's sponsors, all of them, in the order they slide
export const LeagueSponsorsValidation = z.object({
  sponsor_ids: z
    .array(z.number().int().positive())
    .max(100, "Liga može imati najviše 100 sponzora.")
    .refine((ids) => new Set(ids).size === ids.length, "Sponzor je dva puta na popisu."),
});

// a logo shown (each sponsor on the screen) or a sponsor's page opened, in a league
export const SponsorEventValidation = z.object({
  league_id: z.number().int().positive(),
  kind: z.enum(["view", "click"]),
  sponsor_ids: z.array(z.number().int().positive()).min(1).max(100),
});

export type SponsorCreate = z.infer<typeof SponsorCreateValidation>;
export type SponsorUpdate = z.infer<typeof SponsorUpdateValidation>;
export type SponsorEvent = z.infer<typeof SponsorEventValidation>;

// What every screen needs to show a sponsor: the band, its card
export type SponsorPublic = {
  id: number;
  name: string;
  url: string | null;
  message: string;
  background: LogoBackground;
  // the logo's address, with its version, so a new logo isn't served from the cache
  logo: string;
  logo_width: number;
  logo_height: number;
};

export type SponsorCounts = {views: number; clicks: number};

// The admin's list: where each sponsor is shown and how often it was seen, in all and per league
export type SponsorAdmin = SponsorPublic &
  SponsorCounts & {
    leagues: {id: number; name: string}[];
    league_counts: Record<number, SponsorCounts>;
  };
