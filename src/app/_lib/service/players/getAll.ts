import {prisma} from "@/app/_lib/prisma";
import {playersOutput} from "@/app/_interfaces/player";

export async function getAllPlayers(): Promise<playersOutput> {
  const players = await prisma.player.findMany();

  if (!players) {
    throw new Error("Players not found.");
  }

  return playersOutput.parse(players);
}