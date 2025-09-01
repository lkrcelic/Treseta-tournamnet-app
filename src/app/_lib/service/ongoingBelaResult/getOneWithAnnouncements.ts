import {prisma} from "@/app/_lib/prisma";
import {OngoingBelaResult} from "@prisma/client";

export async function getBelaResultWithAnnouncements(ongoingResultId: number): Promise<OngoingBelaResult> {
  return prisma.ongoingBelaResult.findUnique({
    where: {result_id: ongoingResultId},
    include: {belaPlayerAnnouncements: true},
  });
}
