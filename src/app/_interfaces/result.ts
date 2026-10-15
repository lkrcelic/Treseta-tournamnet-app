import {z} from "zod";
import {TeamSideValidation} from "@/app/_interfaces/side";

// One hand: each team's points. Normally they add up to 11; a custom hand (one cut short by "s ovim dosta", or a
// correction) is typed freely. `dosta_side` is the team that called "s ovim dosta" on it (a custom hand only);
// saving a hand without it clears the call.
export const ResultCreateRequestValidation = z.object({
  match_id: z.number().int(),
  team1_game_points: z.number().int(),
  team2_game_points: z.number().int(),
  custom: z.boolean().optional().default(false),
  dosta_side: TeamSideValidation.nullable().optional(),
});

export const ResultResponseValidation = ResultCreateRequestValidation.extend({
  result_id: z.number().int().nullable(),
});

// A hand as the scoreboard lists it
export const PartialResultResponseValidation = z.object({
  result_id: z.number().int().nullable(),
  team1_game_points: z.number(),
  team2_game_points: z.number(),
  custom: z.boolean().optional(),
  dosta_side: TeamSideValidation.nullable().optional(),
});

export type ResultCreateRequest = z.infer<typeof ResultCreateRequestValidation>;
export type ResultResponse = z.infer<typeof ResultResponseValidation>;
