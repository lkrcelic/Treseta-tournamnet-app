import {z} from "zod";
import {
    BelaPlayerAnnouncementRequestValidation,
    BelaPlayerAnnouncementResponseValidation
} from "./belaPlayerAnnouncement";

export const BelaResultCreateRequestValidation = z.object({
    match_id: z.number().int(),
    player_pair1_game_points: z.number().int(),
    player_pair2_game_points: z.number().int(),
    player_pair1_announcement_points: z.number().int(),
    player_pair2_announcement_points: z.number().int(),
    player_pair1_total_points: z.number().int(),
    player_pair2_total_points: z.number().int(),
    card_shuffler_id: z.number().int().optional(),
    trump_caller_id: z.number().int().optional(),
    trump_caller_position: z.union([
        z.literal("FIRST"),
        z.literal("SECOND"),
        z.literal("THIRD"),
        z.literal("FOURTH"),
    ])
        .default("FIRST"),
    pass: z.boolean(),
    complete_victory: z.boolean(),
    announcements: z.array(BelaPlayerAnnouncementRequestValidation).optional().nullable(),
});

export const BelaResultResponseValidation = BelaResultCreateRequestValidation.omit({
    announcements: true
}).extend({
    result_id: z.number().int().nullable(),
    belaPlayerAnnouncements:  z.array(BelaPlayerAnnouncementResponseValidation).optional().nullable()

});

export const PartialBelaResultResponseValidation = z.object({
    result_id: z.number().int().nullable(), //TODO dodati id na svaki result i napraviti update
    player_pair1_total_points: z.number(),
    player_pair2_total_points: z.number(),
});

export type BelaResultCreateRequest = z.infer<typeof BelaResultCreateRequestValidation>;
export type BelaResultResponse = z.infer<typeof BelaResultResponseValidation>;
