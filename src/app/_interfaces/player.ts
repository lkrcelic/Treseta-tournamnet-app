import {RoleEnum} from "@prisma/client";
import {z} from "zod";
import {isValidPhone, normalizePhone, PHONE_ERROR} from "@/app/_lib/phone";
import {normalizeUsername, usernameError} from "@/app/_lib/validation/username";
import {isIsoDate} from "@/app/_lib/nights";

const DATE_FORMAT = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
const NO_CHANGES = "Nema promjena za spremanje.";

export const PlayerCreate = z.object({
  username: z.string().min(3),
  password: z.string().min(5),
  email: z.string().email(),
  first_name: z.string().min(3),
  last_name: z.string().min(3),
  birth_date: z.string().regex(DATE_FORMAT, "Neispravan datum."),
  // "Pušiš li?", right after the birth date; a sign-up page from before the question leaves it out
  smoker: z.boolean().optional(),
  created_at: z.date().optional(),
  last_updated_at: z.date().optional(),
});

export const BIRTH_DATE_ERROR = "Neispravan datum rođenja.";

// The fields a player (or an admin) changes after sign-up, shared by the profile and "Uredi osobne podatke":
// a birth date as YYYY-MM-DD that exists (no 31 February) and isn't in the future
const BirthDateField = z
  .string()
  .regex(DATE_FORMAT, "Neispravan datum.")
  .refine((d) => isIsoDate(d) && d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), BIRTH_DATE_ERROR);
// a new username, stored lowercase (rules in validation/username.ts)
const UsernameField = z
  .string()
  .transform(normalizeUsername)
  .superRefine((u, ctx) => {
    const message = usernameError(u);
    if (message) ctx.addIssue({code: z.ZodIssueCode.custom, message});
  });
// the optional phone number ("" or null removes it), stored as "+385 91 234 5678"
const PhoneField = z
  .string()
  .trim()
  .nullable()
  .refine((p) => !p || isValidPhone(p), PHONE_ERROR)
  .transform((p) => (p ? normalizePhone(p) : null));

// A player changing their own profile: the birth date (Google sign-ups give it later), a new username, the phone
// number and/or whether they smoke
export const PlayerProfileUpdate = z
  .object({
    birth_date: BirthDateField.optional(),
    username: UsernameField.optional(),
    phone: PhoneField.optional(),
    smoker: z.boolean().optional(),
  })
  .refine((o) => o.birth_date !== undefined || o.username !== undefined || o.phone !== undefined || o.smoker !== undefined, NO_CHANGES);

export const EMAIL_TAKEN = "Taj email se već koristi.";

const NameField = (label: string) => z.string().trim().min(1, `${label} je obavezno.`).max(100, `${label} je predugo.`);

// "Uredi osobne podatke" (admin, PATCH /api/admin/players/[id]): any of a player's details, in one request with the
// fields that changed. birth_date null removes it; is_admin gives or takes away the admin role; smoker also counts as
// the answer to "Pušiš li?". Usernames and emails are unique ignoring case (checked by the service, 409).
export const AdminPlayerUpdateValidation = z
  .object({
    first_name: NameField("Ime"),
    last_name: NameField("Prezime"),
    username: UsernameField,
    email: z.string().trim().min(1, "Email je obavezan.").max(100, "Email je predug.").email("Neispravan email."),
    phone: PhoneField,
    birth_date: BirthDateField.nullable(),
    smoker: z.boolean(),
    is_admin: z.boolean(),
  })
  .partial()
  .refine((o) => Object.values(o).some((v) => v !== undefined), NO_CHANGES);
export type AdminPlayerUpdate = z.output<typeof AdminPlayerUpdateValidation>;
// what the panel sends (before trimming and normalising)
export type AdminPlayerUpdateRequest = z.input<typeof AdminPlayerUpdateValidation>;
// the fields that can come back with their own message under the input (a 409 or a 400)
export type AdminPlayerField = "first_name" | "last_name" | "username" | "email" | "phone" | "birth_date";
// ...in the order the panel shows them (the first one with a message gets the focus)
export const ADMIN_PLAYER_FIELDS: readonly AdminPlayerField[] = ["first_name", "last_name", "username", "email", "phone", "birth_date"];

// Deactivate or activate an account (PATCH /api/admin/players/[id]/active); applies at once, apart from Spremi
export const PlayerActiveValidation = z.object({
  active: z.boolean({required_error: "Nedostaje stanje računa.", invalid_type_error: "Nedostaje stanje računa."}),
});
export type PlayerActiveResponse = {id: number; active: boolean};

// A player in the admin directory (Igrači) and the "Dodaj igrača" options (GET /api/admin/players): deleted players
// are left out, deactivated ones are in with active=false. Sorted by name (Croatian order).
export type AdminPlayerRow = {
  id: number;
  first_name: string;
  last_name: string;
  // the full name, or "Igrač bez imena"
  name: string;
  username: string;
  // in Croatian name order
  teams: {team_id: number; team_name: string}[];
  active: boolean;
};

export type PlayerCreateInterface = z.infer<typeof PlayerCreate>;

export const PlayerCreateValidation = PlayerCreate.transform((o) => ({
  username: o.username,
  password_hash: o.password,
  email: o.email,
  first_name: o.first_name,
  last_name: o.last_name,
  birth_date: new Date(o.birth_date),
  smoker: o.smoker ?? false,
  // without an answer the app asks later
  smoker_answered: o.smoker !== undefined,
  created_at: o.created_at,
  last_updated_at: o.last_updated_at,
  player_role: RoleEnum.PLAYER, // No creating admins from API!
}));

export const PlayerPartialResponseValidation = z.object({
  id: z.number().int(),
  username: z.string(),
  first_name: z.string(),
  last_name: z.string(),
});

// Another player as a regular user sees them (GET /api/players/[id]): the name and whether the account is active.
// The username, email, phone, birth date and smoker flag are only for the player themselves and admins.
export const PlayerPublicResponseValidation = z.object({
  id: z.number().int(),
  first_name: z.string(),
  last_name: z.string(),
  active: z.boolean(),
});

// A missing or deleted player (404): GET/PATCH /api/players/[id], the rating detail, the admin player actions
export const PLAYER_NOT_FOUND = "Igrač ne postoji.";
// A deactivated player can't be added to a team, old or new (400)
export const PLAYER_DEACTIVATED = "Igrač je deaktiviran.";

// A player on a page (privacy filter in _lib/players/privacy.ts): everyone gets the first five fields; the personal
// keys are ABSENT (not null) unless the viewer is the player or an admin
export type PlayerView = {id: number; first_name: string; last_name: string; name: string; active: boolean} & Partial<{
  username: string;
  email: string;
  phone: string | null;
  birth_date: string | null; // YYYY-MM-DD
  smoker: boolean;
  is_admin: boolean;
}>;

export const PlayerResponseValidation = PlayerPartialResponseValidation.extend({
  email: z.string(),
  player_role: z.string(),
  rating: z.number().optional(),
});

// One player as the player themselves (or an admin) sees them, with the birth date as YYYY-MM-DD (null when not given),
// the phone number (null when not given) and whether they smoke
export const PlayerSelfResponseValidation = PlayerResponseValidation.extend({
  birth_date: z
    .date()
    .nullable()
    .optional()
    .transform((d) => (d ? d.toISOString().slice(0, 10) : null)),
  phone: z.string().nullable().optional(),
  smoker: z.boolean().optional(),
  // false = deactivated by an admin
  active: z.boolean().optional(),
});
export type PlayerSelfResponse = z.infer<typeof PlayerSelfResponseValidation>;

const PlayerResponses = z.array(PlayerResponseValidation);

export const playersOutput = PlayerResponses;
export type PlayerResponse = z.infer<typeof PlayerResponseValidation>;
export type PlayerPartialResponse = z.infer<typeof PlayerPartialResponseValidation>;
export const PlayerPartialResponseArrayValidation = z.array(PlayerPartialResponseValidation);
