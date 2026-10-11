import {prisma} from "@/app/_lib/prisma";
import {OngoingMatch} from "@prisma/client";
import {CreateOngoingMatchRequest} from "@/app/_interfaces/match";
import {InvalidResultError} from "@/app/_lib/validation/validateResult";
import {lockRound, MATCHES_PER_ROUND} from "@/app/_lib/service/round/finish";

export async function createOngoingMatch(createRequest: CreateOngoingMatchRequest): Promise<OngoingMatch> {
    return prisma.$transaction(async (tx) => {
        // The round lock makes simultaneous "Start Game" taps from several phones end up in the same match
        const round = await lockRound(tx, createRequest.round_id);
        if (!round) {
            throw new InvalidResultError("Round not found.");
        }

        const existingOngoingMatch = await tx.ongoingMatch.findFirst({
            where: {round_id: createRequest.round_id},
            orderBy: {id: "desc"},
        });
        if (existingOngoingMatch) {
            return existingOngoingMatch;
        }

        if (!round.open) {
            throw new InvalidResultError("This round is already finished.");
        }
        const playedMatches = await tx.match.count({where: {round_id: createRequest.round_id}});
        if (playedMatches >= MATCHES_PER_ROUND) {
            throw new InvalidResultError("Both matches of this round are already played.");
        }

        // set here rather than by the columns' CURRENT_DATE / CURRENT_TIME defaults, which use the database's time
        // zone while both are read back as UTC (after local midnight the date would be a day off)
        const now = new Date();
        const ongoingMatch = await tx.ongoingMatch.create({data: {...createRequest, match_date: now, start_time: now}});

        await tx.round.update({
            where: {id: createRequest.round_id},
            data: {active: true},
        });

        return ongoingMatch;
    });
}
