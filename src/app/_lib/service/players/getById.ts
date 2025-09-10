import { prisma } from "@/app/_lib/prisma";
import { PlayerResponseValidation } from "@/app/_interfaces/player";

export async function getPlayerById(id: number) {
  const dbPlayer = await prisma.player.findUnique({
    where: { id },
  });
  if (!dbPlayer) return null;
  return PlayerResponseValidation.parse(dbPlayer);
}