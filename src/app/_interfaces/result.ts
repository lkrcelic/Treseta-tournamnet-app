import {z} from "zod";

export const ResultCreateRequestValidation = z.object({
    match_id: z.number().int(),
    team1_game_points: z.number().int(),
    team2_game_points: z.number().int(),
});

export const ResultResponseValidation = ResultCreateRequestValidation.extend({
    result_id: z.number().int().nullable(),
});

export type ResultCreateRequest = z.infer<typeof ResultCreateRequestValidation>;
export type ResultResponse = z.infer<typeof ResultResponseValidation>;
