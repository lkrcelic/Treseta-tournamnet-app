import {z} from "zod";

// One hand: each team's points. Normally they add up to 11; a custom hand (akuže and the like) is typed freely.
export const ResultCreateRequestValidation = z.object({
  match_id: z.number().int(),
  team1_game_points: z.number().int(),
  team2_game_points: z.number().int(),
  custom: z.boolean().optional().default(false),
});

export const ResultResponseValidation = ResultCreateRequestValidation.extend({
  result_id: z.number().int().nullable(),
});

// A hand as the scoreboard lists it
export const PartialResultResponseValidation = z.object({
  result_id: z.number().int().nullable(),
  team1_game_points: z.number(),
  team2_game_points: z.number(),
});

export type ResultCreateRequest = z.infer<typeof ResultCreateRequestValidation>;
export type ResultResponse = z.infer<typeof ResultResponseValidation>;
