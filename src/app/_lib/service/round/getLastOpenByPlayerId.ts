import {RoundResponse, RoundResponseValidation} from "@/app/_interfaces/round";
import {prisma} from "@/app/_lib/prisma";
import {Prisma} from "@prisma/client";

export async function getLastOpenRoundByPlayerId(playerId: number): Promise<RoundResponse> {
  const dbRound = await prisma.round.findFirst({
    where: {
      open: true,
      OR: [
        {
          team1: {
            teamPlayers: {
              some: {
                player_id: playerId,
              },
            },
          },
        },
        {
          team2: {
            teamPlayers: {
              some: {
                player_id: playerId,
              },
            },
          },
        },
      ],
    },
    orderBy: {
      round_number: 'asc',
    },
  } as Prisma.RoundFindFirstArgs);

  return RoundResponseValidation.parse(dbRound);
}
