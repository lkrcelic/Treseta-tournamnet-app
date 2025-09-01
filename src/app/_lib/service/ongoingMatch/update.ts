import {BelaResultCreateRequest} from "@/app/_interfaces/belaResult";
import {prisma} from "../../prisma";

export async function incrementOngoingMatchScore(belaResult: BelaResultCreateRequest): Promise<void> {
    await prisma.ongoingMatch.update({
        where: {id: belaResult.match_id},
        data: {
            player_pair1_score: {
                increment: belaResult.player_pair1_total_points,
            },
            player_pair2_score: {
                increment: belaResult.player_pair2_total_points,
            }
        },
        select: {
            player_pair1_score: true,
            player_pair2_score: true,
            score_threshold: true,
        },
    })
}


type UpdateOngoingMatchScoreProps = {
    result_id: number,
    resultData: BelaResultCreateRequest,
}

export async function updateOngoingMatchScore({
                                                  result_id,
                                                  resultData: {
                                                      match_id,
                                                      player_pair1_total_points,
                                                      player_pair2_total_points
                                                  }
                                              }: UpdateOngoingMatchScoreProps): Promise<void> {
    await prisma.$transaction(async (tx) => {
        const existingResult = await tx.ongoingBelaResult.findUnique({
            where: {result_id: result_id},
            select: {
                player_pair1_total_points: true,
                player_pair2_total_points: true,
            },
        })

        if (!existingResult) {
            throw new Error(`BelaResult with id ${result_id} not found.`)
        }

        const diffPlayerPair1 = player_pair1_total_points - existingResult.player_pair1_total_points
        const diffPlayerPair2 = player_pair2_total_points - existingResult.player_pair2_total_points

        await tx.ongoingMatch.update({
            where: {id: match_id},
            data: {
                player_pair1_score: {
                    increment: diffPlayerPair1,
                },
                player_pair2_score: {
                    increment: diffPlayerPair2,
                },
            },
        })
    })
}

