import { prisma } from "@/app/_lib/prisma";
import { PlayerSelfResponseValidation } from "@/app/_interfaces/player";
import { isDbId } from "@/app/_lib/helpers/query/dbId";

// One player with every field (the route filters it for other viewers); null when missing or deleted
export async function getPlayerById(id: number) {
  if (!isDbId(id)) return null;
  const dbPlayer = await prisma.player.findFirst({
    where: { id, deleted_at: null },
  });
  if (!dbPlayer) return null;
  return PlayerSelfResponseValidation.parse(dbPlayer);
}
