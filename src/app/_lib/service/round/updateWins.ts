import {prisma} from "@/app/_lib/prisma";

export async function updateRoundWins(round_id: number, player_pair1_score: number, player_pair2_score: number): Promise<void> {
    await prisma.round.update({
            where: {id: round_id},
            data: {
                team1_wins: {
                    increment: player_pair1_score > player_pair2_score ? 1 : 0,
                },
                team2_wins: {
                    increment: player_pair2_score > player_pair1_score ? 1 : 0,
                },
            },
        }
    );
}