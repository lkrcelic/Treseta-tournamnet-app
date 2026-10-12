import {prisma} from "@/app/_lib/prisma";
import {playersOutput} from "@/app/_interfaces/player";
import {z} from "zod";

// Every player except the deleted ones (admin)
export async function getAllPlayers(): Promise<z.infer<typeof playersOutput>> {
  const players = await prisma.player.findMany({where: {deleted_at: null}});

  return playersOutput.parse(players);
}
