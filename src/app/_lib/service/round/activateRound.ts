import {prisma} from "@/app/_lib/prisma";

export async function activateRound(round_id: number): Promise<void> {
   await prisma.round.update({
    where: {
      id: round_id,
    },
    data: {
      active: true,
    },
  });
}
