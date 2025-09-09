import {prisma} from "@/app/_lib/prisma";
import {MatchExtendedResponse, MatchExtendedResponseValidation} from "@/app/_interfaces/match";
import {Prisma} from "@prisma/client";

export async function getMatchByIdWithResults(id: number): Promise<MatchExtendedResponse> {
  const dbMatch = await prisma.match.findUnique({
    where: {
      id: id,
    },
    include: {
      results: {
        orderBy: {
          result_id: 'asc',
        },
      },
    },
  } as Prisma.MatchFindUniqueArgs)

  return MatchExtendedResponseValidation.parse(dbMatch);
}

