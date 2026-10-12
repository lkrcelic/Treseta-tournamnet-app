import {prisma} from "@/app/_lib/prisma";
import {playersOutput} from "@/app/_interfaces/player";
import {z} from "zod";

export async function getAllPlayers(): Promise<z.infer<typeof playersOutput>> {
  const players = await prisma.player.findMany();

  return playersOutput.parse(players);
}