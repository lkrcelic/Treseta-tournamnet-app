import { MatchResponse, MatchResponseValidation } from "@/app/_interfaces/match";
import { prisma } from "@/app/_lib/prisma";
import { z } from "zod";


export async function getAllMatchesByQuery(searchParams: URLSearchParams): Promise<MatchResponse[]> {
  const roundId = searchParams.get("round_id");

  const matches = await prisma.match.findMany({
    where: {
      round_id: Number(roundId),
    },
  });


  return z.array(MatchResponseValidation).parse(matches);
}
