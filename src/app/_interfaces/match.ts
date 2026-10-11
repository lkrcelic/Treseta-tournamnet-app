import {z} from "zod";
import {PartialResultResponseValidation} from "@/app/_interfaces/result";

const parseDate = z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) {
        return new Date(arg);
    }
    return arg;
}, z.date());

export const MatchRequestValidation = z.number();

export const OngoingMatchRequestValidation = z.object({
    round_id: z.number().int().nullable().optional(),
    player_pair1_score: z.number().int().optional(),
    player_pair2_score: z.number().int().optional(),
    score_threshold: z.number().int().optional().nullable(), //TODO nema nullable
    start_time: parseDate.nullable().optional(),
    end_time: parseDate.nullable().optional(),
    match_date: parseDate.optional(),
});

export const OngoingMatchResponseValidation = z.object({
    id: z.number().int(),
    round_id: z.number().int().nullable(),
    player_pair1_score: z.number().int(),
    player_pair2_score: z.number().int(),
    score_threshold: z.number().int(),
    start_time: parseDate.nullable(),
    end_time: parseDate.nullable().optional(),
    match_date: parseDate.optional(),
});

export const MatchResponseValidation = OngoingMatchRequestValidation.extend({
    results: z.array(PartialResultResponseValidation).optional(),
});

export const OngoingMatchExtendedResponseValidation = OngoingMatchResponseValidation.extend({
    results: z.array(PartialResultResponseValidation).optional(),
});

export const CreateOngoingMatchRequestValidation = z.object({
    score_threshold: z.number().int(),
    round_id: z.number().int(),
});

export type CreateOngoingMatchRequest = z.infer<typeof CreateOngoingMatchRequestValidation>;
export type MatchResponse = z.infer<typeof MatchResponseValidation>;
export type OngoingMatchResponse = z.infer<typeof OngoingMatchResponseValidation>;
export type OngoingMatchExtendedResponse = z.infer<typeof OngoingMatchExtendedResponseValidation>;
export type OngoingMatchRequest = z.infer<typeof OngoingMatchRequestValidation>;
export type MatchRequest = z.infer<typeof MatchRequestValidation>
