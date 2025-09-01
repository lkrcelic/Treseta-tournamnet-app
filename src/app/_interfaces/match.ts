import { PartialBelaResultResponseValidation } from "@/app/_interfaces/belaResult";
import { z } from "zod";
import { TeamResponseValidation } from "./team";

const parseDate = z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) {
        return new Date(arg);
    }
    return arg;
}, z.date());


export const MatchRequestValidation = z.object({
    round_id: z.number().int().nullable().optional(),
    team1_score: z.number().int().optional(),
    team2_score: z.number().int().optional(),
    team1_id: z.number().int().optional(),
    team2_id: z.number().int().optional(),
    score_threshold: z.number().int().optional().nullable(), //TODO nema nullable
    start_time: parseDate.nullable().optional(),
    end_time: parseDate.nullable().optional(),
    match_date: parseDate.optional(),
});

export const MatchResponseValidation = MatchRequestValidation.extend({
    id: z.number().int(),
});

export const MatchExtendedResponseValidation = MatchResponseValidation.extend({
    team1:  TeamResponseValidation,
    team2: TeamResponseValidation,
    results: z.array(PartialBelaResultResponseValidation).optional(),
});

export const CreateMatchRequestValidation = z.object({
    score_threshold: z.number().int(),
    round_id: z.number().int(),
    team1_id: z.number().int(),
    team2_id: z.number().int(),
    active: z.boolean().default(true),
});

export type CreateMatchRequest = z.infer<typeof CreateMatchRequestValidation>;
export type MatchResponse = z.infer<typeof MatchResponseValidation>;
export type MatchExtendedResponse = z.infer<typeof MatchExtendedResponseValidation>;
export type MatchRequest = z.infer<typeof MatchRequestValidation>;
