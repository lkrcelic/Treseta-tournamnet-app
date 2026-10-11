import { MatchResponse, MatchResponseValidation } from "@/app/_interfaces/match";
import { prisma } from "@/app/_lib/prisma";
import { z } from "zod";


export async function getAllMatchesByRoundId(id: number): Promise<MatchResponse[]> {
  const matches = await prisma.match.findMany({
    where: {
      round_id: Number(id),
    },
    // match 1 first
    orderBy: {id: "asc"},
  });

  if (!matches) {
    throw new Error("");
  }

  return z.array(MatchResponseValidation).parse(matches);
}