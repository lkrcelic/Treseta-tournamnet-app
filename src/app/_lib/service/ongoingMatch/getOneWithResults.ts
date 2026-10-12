import {prisma} from "@/app/_lib/prisma";
import {OngoingMatchExtendedResponseValidation, OngoingMatchExtendedResponse} from "@/app/_interfaces/match";
import {Prisma} from "@prisma/client";
import {NotFoundError} from "@/app/_lib/service/admin/tables";

export async function getOngoingMatchWithResults(id: number): Promise<OngoingMatchExtendedResponse> {
  // an id that isn't a whole number (/ongoing-match/abc) can't be a match
  if (!Number.isInteger(id)) throw new NotFoundError("Meč ne postoji.");

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
          custom: true,
          dosta_side: true,
        },
      },
    },
  } as Prisma.OngoingMatchFindUniqueArgs)

  if (!dbOngoingMatch) {
    // a finished match is gone; phones following it ask for it regularly (404, not logged)
    throw new NotFoundError("Meč ne postoji.");
  }

  return OngoingMatchExtendedResponseValidation.parse(dbOngoingMatch);
}
