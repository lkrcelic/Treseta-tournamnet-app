import {RoundExtendedResponse} from "@/app/_interfaces/round";
import {prisma} from "@/app/_lib/prisma";

export async function getRoundById(id: number): Promise<RoundExtendedResponse> {
    const dbRound = await prisma.round.findUnique({
        where: {
            id: Number(id),
        },
        include: {
            team1: {
                include: {
                    teamPlayers: {
                        include: {
                            player: {
                                select: {
                                    id: true,
                                    username: true,
                                    first_name: true,
                                    last_name: true,
                                },
                            },
                        },
                    },
                },
            },
            team2: {
                include: {
                    teamPlayers: {
                        include: {
                            player: {
                                select: {
                                    id: true,
                                    username: true,
                                    first_name: true,
                                    last_name: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!dbRound) {
        throw new Error("Round not found.");
    }

    return dbRound;
}