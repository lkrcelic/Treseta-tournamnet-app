import {prisma} from "@/app/_lib/prisma";
import { ResultCreateRequestValidation, ResultCreateRequest } from "@/app/_interfaces/result";

export async function createResult(requestData: ResultCreateRequest): Promise<void> {

    const validatedRequest = ResultCreateRequestValidation.parse(requestData);

    await prisma.$transaction(async (tx) => {
        const created = await tx.result.create({
            data: {
                match: { connect: { id: validatedRequest.match_id } },
                team1_game_points: validatedRequest.team1_game_points,
                team2_game_points: validatedRequest.team2_game_points,
            },
            select: { match_id: true },
        });

        const totals = await tx.result.aggregate({
            _sum: { team1_game_points: true, team2_game_points: true },
            where: { match_id: created.match_id },
        });

        await tx.match.update({
            where: { id: created.match_id },
            data: {
                team1_score: totals._sum.team1_game_points ?? 0,
                team2_score: totals._sum.team2_game_points ?? 0,
            },
        });
    });
}