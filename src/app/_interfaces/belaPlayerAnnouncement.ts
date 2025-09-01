import {z} from "zod";

const AnnouncementValidation = z.union([
    z.literal("TWENTY"),
    z.literal("FIFTY"),
    z.literal("ONE_HUNDRED"),
    z.literal("ONE_HUNDRED_FIFTY"),
    z.literal("TWO_HUNDRED")])

export const BelaPlayerAnnouncementRequestValidation = z.object({
    player_id: z.number().int(),
    announcement_type: AnnouncementValidation,
});

export const BelaPlayerAnnouncementResponseValidation = BelaPlayerAnnouncementRequestValidation.extend({
        announcement_id: z.number().int(),
        result_id: z.number().int(),
    }
);

export type BelaPlayerAnnouncementsRequest = z.infer<typeof BelaPlayerAnnouncementRequestValidation>;
export type BelaPlayerAnnouncementResponse = z.infer<typeof BelaPlayerAnnouncementResponseValidation>;
export type AnnouncementType = z.infer<typeof AnnouncementValidation>;
