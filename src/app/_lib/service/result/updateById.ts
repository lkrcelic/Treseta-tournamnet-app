import {ResultCreateRequest} from "@/app/_interfaces/result";
import {prisma} from "@/app/_lib/prisma";

type UpdateResultType = {
    result_id: number,
    resultData: ResultCreateRequest,
}

export async function updateResultById({result_id, resultData}: UpdateResultType): Promise<void> {

    delete resultData.match_id

    try {
        await prisma.$transaction(async (tx) => {
            await tx.result.update({
                where: {result_id: result_id},
                data: resultData,
            });
        });
    } catch (error) {
        console.error(`Failed to update Result with result_id ${result_id}:`, error);
        throw error;
    }

}