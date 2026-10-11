import {prisma} from "@/app/_lib/prisma";

// Used to check that the person changing a match or hand is playing in that round.
export async function getRoundIdOfOngoingMatch(ongoingMatchId: number): Promise<number | null | undefined> {
  const match = await prisma.ongoingMatch.findUnique({where: {id: ongoingMatchId}, select: {round_id: true}});
  return match?.round_id;
}

export async function getRoundIdOfOngoingResult(resultId: number): Promise<number | null | undefined> {
  const result = await prisma.ongoingResult.findUnique({
    where: {result_id: resultId},
    select: {match: {select: {round_id: true}}},
  });
  return result?.match.round_id;
}
