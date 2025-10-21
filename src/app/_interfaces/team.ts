import {z} from "zod";
import {PlayerPartialResponseValidation} from "@/app/_interfaces/player";


const parseDate = z.preprocess((arg) => {
  if (typeof arg === "string" || arg instanceof Date) {
    return new Date(arg);
  }
  return arg;
}, z.date());

export const TeamRequestValidation = z.object({
  team_name: z.string().min(1),
  founder_id1: z.number().int().optional(),
  founder_id2: z.number().int().optional(),
  creator_id: z.number().int().optional(),
  created_at: parseDate.optional().nullable(),
  last_updated_at: parseDate.optional().nullable(),
});

export const TeamResponseValidation = z.object({
  team_id: z.number().int(),
  team_name: z.string(),
  founder_id1: z.number().int().nullable(),
  founder_id2: z.number().int().nullable(),
  creator_id: z.number().int().nullable(),
  created_at: parseDate.optional().nullable(),
  last_updated_at: parseDate.optional().nullable(),
  teamPlayers: z.array(
    z.object({
      player: PlayerPartialResponseValidation,
    })
  ).optional().nullable(),
});

export const TeamExtendedResponseValidation = TeamResponseValidation.extend({
  founder1: PlayerPartialResponseValidation.optional(),
  founder2: PlayerPartialResponseValidation.optional(),
  creator: PlayerPartialResponseValidation.optional(),
  teamPlayers: z.array(
    z.object({
      player: PlayerPartialResponseValidation,
    })
  ),
});

export const AddTeammateRequestValidation = z.object({
  team_id: z.number().int(),
  player_id: z.number().int(),
});

export const TeamsResponseValidation = z.array(TeamResponseValidation);

export type TeamResponse = z.infer<typeof TeamResponseValidation>;
export type TeamExtendedResponse = z.infer<typeof TeamExtendedResponseValidation>;
