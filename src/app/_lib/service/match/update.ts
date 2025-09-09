import { ResultCreateRequest } from "@/app/_interfaces/result";
import { prisma } from "../../prisma";

type UpdateMatchScoreProps = {
    result_id: number,
    resultData: ResultCreateRequest,
}

export async function updateMatchScore({
                                                  result_id,
                                                  resultData: {
                                                      match_id,
                                                      team1_game_points,
                                                      team2_game_points
                                                  }
                                              }: UpdateMatchScoreProps): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const existingResult = await tx.result.findUnique({
            where: {result_id: result_id},
            select: {
                team1_game_points: true,
                team2_game_points: true,
            },
        })

        if (!existingResult) {
            throw new Error(`Result with id ${result_id} not found.`)
        }

        const diffPlayerPair1 = team1_game_points - existingResult.team1_game_points
        const diffPlayerPair2 = team2_game_points - existingResult.team2_game_points

        await tx.match.update({
            where: {id: match_id},
            data: {
                team1_score: {
                    increment: diffPlayerPair1,
                },
                team2_score: {
                    increment: diffPlayerPair2,
                },
            },
        })
    })
}

