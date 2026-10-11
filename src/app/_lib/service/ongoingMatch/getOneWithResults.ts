import {prisma} from "@/app/_lib/prisma";
import {OngoingMatchExtendedResponseValidation, OngoingMatchExtendedResponse} from "@/app/_interfaces/match";
import {Prisma} from "@prisma/client";

export async function getOngoingMatchWithResults(id: number): Promise<OngoingMatchExtendedResponse> {
  const dbOngoingMatch = await prisma.ongoingMatch.findUnique({
    where: {
      id: id,
    },
    include: {
      results: {
        orderBy: {
          result_id: 'asc',
        },
        select: {
          result_id: true,
          team1_game_points: true,
          team2_game_points: true,
        },
      },
    },
  } as Prisma.OngoingMatchFindUniqueArgs)

  if (!dbOngoingMatch) {
    throw new Error("Ongoing match not found.");
  }

  return OngoingMatchExtendedResponseValidation.parse(dbOngoingMatch);
}
