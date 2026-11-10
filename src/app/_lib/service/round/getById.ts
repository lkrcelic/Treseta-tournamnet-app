import {RoundExtendedResponse, RoundExtendedResponseValidation} from "@/app/_interfaces/round";
import {prisma} from "@/app/_lib/prisma";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {visibleRounds} from "@/app/_lib/roundStatus";

// admin: also a round that isn't published yet (for anyone else it doesn't exist)
export async function getRoundById(id: number, admin = false): Promise<RoundExtendedResponse> {
    // an id that isn't a whole number can't be a round
    if (!Number.isInteger(id)) throw new NotFoundError("Runda ne postoji.");

    const dbRound = await prisma.round.findFirst({
        where: {
            id: Number(id),
            ...visibleRounds(admin),
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
            leagueRounds: {select: {league_id: true}},
            tournamentRounds: {select: {tournament_id: true}},
        },
    });

    if (!dbRound) {
        throw new NotFoundError("Runda ne postoji.");
    }

    // the league or the tournament the table is in, for the links back from it
    return RoundExtendedResponseValidation.parse({
        ...dbRound,
        league_id: dbRound.leagueRounds[0]?.league_id,
        tournament_id: dbRound.tournamentRounds[0]?.tournament_id,
    });
}