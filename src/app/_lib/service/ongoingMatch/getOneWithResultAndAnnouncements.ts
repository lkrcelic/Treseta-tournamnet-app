import {prisma} from "@/app/_lib/prisma";
import {OngoingMatch} from "@prisma/client";

export async function getOngoingMatchWithResultsAndAnnouncements(ongoingMatchId: number): Promise<OngoingMatch> {
    return prisma.ongoingMatch.findUnique({
        where: {id: ongoingMatchId},
        include: {belaResults: {include: {belaPlayerAnnouncements: true}}}
    });
}