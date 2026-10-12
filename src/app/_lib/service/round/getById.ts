import {RoundExtendedResponse, RoundExtendedResponseValidation} from "@/app/_interfaces/round";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";

export async function getRoundById(id: number): Promise<RoundExtendedResponse> {
    // an id that isn't a whole number can't be a round
    if (!Number.isInteger(id)) throw new NotFoundError("Runda ne postoji.");

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
                                // no usernames: they are private (handoff §6), and any logged-in player reads this
                                select: {
                                    id: true,
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
                                // no usernames: they are private (handoff §6), and any logged-in player reads this
                                select: {
                                    id: true,
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
        throw new NotFoundError("Runda ne postoji.");
    }

    return RoundExtendedResponseValidation.parse(dbRound);
}