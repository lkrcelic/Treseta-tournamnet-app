import { MatchResponse } from "@/app/_interfaces/match";
import { prisma } from "@/app/_lib/prisma";
import { Match } from "@prisma/client";

export async function finishMatch(matchId: number): Promise<MatchResponse> {
 return await prisma.match.update({
    where: {
      id: matchId,
    },
    data: {
      active: false,
      end_time: new Date(Date.now()),
    },
  });
}
