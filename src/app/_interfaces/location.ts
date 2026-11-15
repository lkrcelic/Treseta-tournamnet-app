import {isSafeUrl} from "@/app/_lib/nights";
import {count, NOUN, NounForms} from "@/app/_lib/ui/text";
import {z} from "zod";

// The place of a two-place night a request is about (1 or 2); null or left out: a one-place night
export const slotField = z.union([z.literal(1), z.literal(2)]).nullable().optional();

// Lokacije (Admin · Lokacije, LOCATIONS_PLAN.md): the places where league nights and tournaments are played, one
// shared list. A place is a name, an address and a link to Google Maps. The link isn't checked to be a Google Maps
// one; it only has to be http(s), so it can't run a script when clicked. An empty address or link is saved as null.

export const LOCATION_NAME_REQUIRED = "Ime mjesta je obavezno.";
export const LOCATION_URL_ERROR = "Link mora počinjati s https://.";
export const LOCATION_NOT_FOUND = "Lokacija ne postoji.";
export const LOCATION_IN_USE = "Lokacija se koristi, pa se ne može obrisati.";
export const LOCATION_NAME_TAKEN = "Lokacija s tim imenom već postoji.";

export const locationName = z.string().trim().min(1, LOCATION_NAME_REQUIRED).max(100, "Ime mjesta može imati najviše 100 znakova.");
export const locationAddress = z.string().trim().max(200, "Adresa može imati najviše 200 znakova.");
export const locationUrl = z
  .string()
  .trim()
  .max(500, "Link može imati najviše 500 znakova.")
  .refine((v) => v === "" || isSafeUrl(v), LOCATION_URL_ERROR);

// Dodaj lokaciju, and Nova lokacija in a place picker
export const LocationCreateValidation = z.object({
  name: locationName,
  address: locationAddress.nullable().optional(),
  url: locationUrl.nullable().optional(),
});

// Uredi lokaciju: the fields left out stay as they are
export const LocationUpdateValidation = z
  .object({
    name: locationName.optional(),
    address: locationAddress.nullable().optional(),
    url: locationUrl.nullable().optional(),
  })
  .refine((b) => b.name !== undefined || b.address !== undefined || b.url !== undefined, "Nema promjene.");

export type LocationCreate = z.infer<typeof LocationCreateValidation>;
export type LocationUpdate = z.infer<typeof LocationUpdateValidation>;

// A place pointed at by an id (Podaci lige, Uredi večer, Nova liga, the tournament form); null: none
export const locationIdField = z.number({invalid_type_error: LOCATION_NOT_FOUND}).int().positive(LOCATION_NOT_FOUND).nullable();

// What uses a place: Lokacije shows it, and a place with any of it can't be deleted
export type LocationUse = {leagues: number; nights: number; tournaments: number};

// A place as Lokacije and the pickers list it
export type LocationView = {
  location_id: number;
  name: string;
  address: string | null;
  url: string | null;
  uses: LocationUse;
};

// "2 lige · 14 večeri · 1 turnir"; empty when nothing uses it
export function locationUseLabel(u: LocationUse): string {
  return [u.leagues && count(u.leagues, NOUN.liga), u.nights && count(u.nights, NOUN.večer), u.tournaments && count(u.tournaments, TURNIR)]
    .filter(Boolean)
    .join(" · ");
}

const TURNIR: NounForms = ["turnir", "turnira", "turnira"];

export const inUse = (u: LocationUse) => u.leagues + u.nights + u.tournaments > 0;
