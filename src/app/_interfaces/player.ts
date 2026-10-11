import {RoleEnum} from "@prisma/client";
import {z} from "zod";
import {normalizeUsername, usernameError} from "@/app/_lib/validation/username";

const DATE_FORMAT = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export const PlayerCreate = z.object({
  username: z.string().min(3),
  password: z.string().min(5),
  email: z.string().email(),
  first_name: z.string().min(3),
  last_name: z.string().min(3),
  birth_date: z.string().regex(DATE_FORMAT, "Invalid date format."),
  created_at: z.date().optional(),
  last_updated_at: z.date().optional(),
});

// A player changing their own profile: the birth date (Google sign-ups give it later) and/or a new username,
// stored lowercase (rules in validation/username.ts)
export const PlayerProfileUpdate = z
  .object({
    birth_date: z
      .string()
      .regex(DATE_FORMAT, "Invalid date format.")
      .refine((d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Invalid birth date.")
      .optional(),
    username: z
      .string()
      .transform(normalizeUsername)
      .superRefine((u, ctx) => {
        const message = usernameError(u);
        if (message) ctx.addIssue({code: z.ZodIssueCode.custom, message});
      })
      .optional(),
  })
  .refine((o) => o.birth_date !== undefined || o.username !== undefined, "Nothing to update.");

export type PlayerCreateInterface = z.infer<typeof PlayerCreate>;

export const PlayerCreateValidation = PlayerCreate.transform((o) => ({
  username: o.username,
  password_hash: o.password,
  email: o.email,
  first_name: o.first_name,
  last_name: o.last_name,
  birth_date: new Date(o.birth_date),
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

export const PlayerResponseValidation = PlayerPartialResponseValidation.extend({
  email: z.string(),
  player_role: z.string(),
  rating: z.number().optional(),
});

// One player as the player themselves (or an admin) sees them, with the birth date as YYYY-MM-DD (null when not given)
export const PlayerSelfResponseValidation = PlayerResponseValidation.extend({
  birth_date: z
    .date()
    .nullable()
    .optional()
    .transform((d) => (d ? d.toISOString().slice(0, 10) : null)),
});
export type PlayerSelfResponse = z.infer<typeof PlayerSelfResponseValidation>;

const PlayerResponses = z.array(PlayerResponseValidation);

export const playersOutput = PlayerResponses;
export type PlayerResponse = z.infer<typeof PlayerResponseValidation>;
export type PlayerPartialResponse = z.infer<typeof PlayerPartialResponseValidation>;
export const PlayerPartialResponseArrayValidation = z.array(PlayerPartialResponseValidation);
