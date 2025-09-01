import { Prisma } from "@prisma/client";
import { prisma } from "@/app/_lib/prisma";

export async function getActiveMatchByRoundId(roundId: number): Promise<{ id: number } | null> {
  const activeMatch = await prisma.match.findFirst({
    where: {
      round_id: roundId,
      active: true,
    },
    select: { id: true },
    orderBy: {
      start_time: 'asc',
    },
  } as Prisma.MatchFindFirstArgs);

  return activeMatch;
}
