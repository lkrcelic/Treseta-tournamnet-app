import { ResultResponseValidation } from "@/app/_interfaces/result";
import { z } from "zod";

const parseDate = z.preprocess((arg) => {
  if (typeof arg === "string" || arg instanceof Date) {
    return new Date(arg);
  }
  return arg;
}, z.date());

export const MatchRequestValidation = z.object({
  round_id: z.number().int().nullable().optional(),
  team1_score: z.number().int().optional(),
  team2_score: z.number().int().optional(),
  score_threshold: z.number().int().optional().nullable(), //TODO nema nullable
  start_time: parseDate.nullable().optional(),
  end_time: parseDate.nullable().optional(),
  match_date: parseDate.optional(),
  active: z.boolean().optional().default(true),
});

export const MatchResponseValidation = z.object({
    id: z.number().int(),
    round_id: z.number().int(),
    team1_score: z.number().int(),
    team2_score: z.number().int(),
    score_threshold: z.number().int(),
    start_time: parseDate,
    end_time: parseDate.nullable().optional(),
    match_date: parseDate,
    active: z.boolean(),
});

export const MatchExtendedResponseValidation = MatchResponseValidation.extend({
  results: z.array(ResultResponseValidation).optional(),
});

export const MatchCreateRequestValidation = z.object({
  score_threshold: z.number().int(),
  round_id: z.number().int(),
  active: z.boolean().optional().default(true),
});

export type MatchCreateRequest = z.infer<typeof MatchCreateRequestValidation>;
export type MatchResponse = z.infer<typeof MatchResponseValidation>;
export type MatchExtendedResponse = z.infer<typeof MatchExtendedResponseValidation>;
export type MatchRequest = z.infer<typeof MatchRequestValidation>;
