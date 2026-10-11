import { prisma } from "@/app/_lib/prisma";
import { PlayerSelfResponseValidation } from "@/app/_interfaces/player";

export async function getPlayerById(id: number) {
  const dbPlayer = await prisma.player.findUnique({
    where: { id },
  });
  if (!dbPlayer) return null;
  return PlayerSelfResponseValidation.parse(dbPlayer);
}
