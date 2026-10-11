import {prisma} from "@/app/_lib/prisma";
import {OngoingResult} from "@prisma/client";

export async function getOngoingResult(ongoingResultId: number): Promise<OngoingResult | null> {
  return prisma.ongoingResult.findUnique({
    where: {result_id: ongoingResultId},
  });
}
