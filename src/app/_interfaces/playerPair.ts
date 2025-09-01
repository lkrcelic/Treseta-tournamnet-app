import {z} from "zod";
import {PlayerResponseValidation} from "@/app/_interfaces/player";

export const PlayerPairResponseValidation = z.object({
    id: z.number().int(),
    player_id1: z.number().int(),
    player_id2: z.number().int(),
    player1: PlayerResponseValidation,
    player2: PlayerResponseValidation,
});

export const PlayerPairRequestValidation = z.object({
    player_id1: z.number().int(),
    player_id2: z.number().int(),
});

export type PlayerPairResponse = z.infer<typeof PlayerPairResponseValidation>;
