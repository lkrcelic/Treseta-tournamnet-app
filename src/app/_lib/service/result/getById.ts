import {prisma} from "@/app/_lib/prisma";
import {Result} from "@prisma/client";

export async function getResultbyId(resultId: number): Promise<Result> {
  return prisma.result.findUnique({
    where: {result_id: resultId},
  });
}
