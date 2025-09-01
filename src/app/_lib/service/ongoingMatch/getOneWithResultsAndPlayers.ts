import {prisma} from "@/app/_lib/prisma";
import {OngoingMatchResponseValidation} from "@/app/_interfaces/match";
import {Prisma} from "@prisma/client";

export async function getOngoingMatchWithResultsAndPlayers(id: number): Promise<OngoingMatchResponseValidation> {
  const dbOngoingMatch = await prisma.ongoingMatch.findUnique({
    where: {
      id: id,
    },
    include: {
      belaResults: {
        orderBy: {
          result_id: 'asc',
        },
        select: {
          result_id: true,
          player_pair1_total_points: true,
          player_pair2_total_points: true,
        },
      },
      playerPair1: {
        include: {
          player1: {
            select: {
              id: true,
              username: true,
              email: true,
              player_role: true,
              first_name: true,
              last_name: true,
            },
          },
          player2: {
            select: {
              id: true,
              username: true,
              email: true,
              player_role: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      },
      playerPair2: {
        include: {
          player1: {
            select: {
              id: true,
              username: true,
              email: true,
              player_role: true,
              first_name: true,
              last_name: true,
            },
          },
          player2: {
            select: {
              id: true,
              username: true,
              email: true,
              player_role: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      },
    },
  } as Prisma.OngoingMatchFindUniqueArgs)

  if (!dbOngoingMatch) {
    throw new Error("Ongoing match not found.");
  }

  return dbOngoingMatch;
}