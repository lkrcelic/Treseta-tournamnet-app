import {TeamResponseValidation} from "@/app/_interfaces/team";
import {z} from "zod";
import {MatchResponseValidation} from "./match";

export const RoundResponseValidation = z.object({
  id: z.number().int().optional(),
  tournament_id: z.number().int().optional(),
  league_id: z.number().int().optional(),
  round_number: z.number().int(),
  round_date: z.date(),
  team1_id: z.number().int(),
  team2_id: z.number().int(),
  team1_wins: z.number().int(),
  team2_wins: z.number().int(),
  open: z.boolean(),
  active: z.boolean(),
  table_number: z.number().int(),
});

export const ExtendedRoundResponseValidation = RoundResponseValidation.extend({
  team1: TeamResponseValidation,
  team2: TeamResponseValidation,
  matches: z.array(MatchResponseValidation).optional(),
});

export const CreateRoundRequestValidation = z.object({
  league_id: z.number().int(),
  present_teams: z.array(z.number().int()).min(1),
});

export type CreateRoundRequest = z.infer<typeof CreateRoundRequestValidation>;
export type RoundExtendedResponse = z.infer<typeof ExtendedRoundResponseValidation>;
export type RoundResponse = z.infer<typeof RoundResponseValidation>;
