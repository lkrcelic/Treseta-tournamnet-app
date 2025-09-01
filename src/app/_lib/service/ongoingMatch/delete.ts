import {prisma} from "@/app/_lib/prisma";

export async function deleteOngoingMatch(id: number): Promise<void> {
    await prisma.ongoingMatch.delete({where: {id: id}});
}