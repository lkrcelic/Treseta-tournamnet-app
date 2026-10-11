import {z} from "zod";

// 1 = team1 (round.team1), 2 = team2 (round.team2)
export const TeamSideValidation = z.union([z.literal(1), z.literal(2)]);

export type TeamSide = z.infer<typeof TeamSideValidation>;
