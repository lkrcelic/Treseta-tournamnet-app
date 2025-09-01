import {RoleEnum} from "@prisma/client";
import {z} from "zod";

export const PlayerCreate = z.object({
  username: z.string().min(3),
  password: z.string().min(5),
  email: z.string().email(),
  first_name: z.string().min(3),
  last_name: z.string().min(3),
  birth_date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, "Invalid date format."),
  created_at: z.date().optional(),
  last_updated_at: z.date().optional(),
});


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
});

const PlayerResponses = z.array(PlayerResponseValidation);

export const playersOutput = PlayerResponses;
export type PlayerResponse = z.infer<typeof PlayerResponseValidation>;
export type PlayerPartialResponse = z.infer<typeof PlayerPartialResponseValidation>;
export const PlayerPartialResponseArrayValidation = z.array(PlayerPartialResponseValidation);

