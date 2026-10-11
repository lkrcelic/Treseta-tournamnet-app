import {OngoingMatchResponse, OngoingMatchResponseValidation} from "@/app/_interfaces/match";
import {prisma} from "@/app/_lib/prisma";
import {Prisma} from "@prisma/client";

export async function getNewestOngoingMatchByRoundId(roundId: number): Promise<OngoingMatchResponse | null> {
  const ongoingMatch = await prisma.ongoingMatch.findFirst({
    where: {
      round_id: roundId,
    },
    orderBy: {
      id: "desc",
    }
  } as Prisma.OngoingMatchFindFirstArgs);

  if (!ongoingMatch) {
    return null;
  }

  return OngoingMatchResponseValidation.parse(ongoingMatch);
}
