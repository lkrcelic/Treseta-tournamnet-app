import {prisma} from "../prisma";
import {PlayerPairRequestValidation} from "@/app/_interfaces/playerPair";

export async function checkPlayersValid(seatingOrder: number[]): Promise<boolean> {
  const dbPlayers = await prisma.player.findMany({
    where: {id: {in: seatingOrder}},
  });

  return dbPlayers.length === 4;
}

export async function insertPlayerPair(playerPair: PlayerPairRequestValidation): Promise<number> {
  const existingPair = await prisma.playerPair.findMany({
    where: {
      OR: [
        {player_id1: playerPair.player_id1, player_id2: playerPair.player_id2},
        {player_id1: playerPair.player_id2, player_id2: playerPair.player_id1},
      ],
    },
  });

  if (existingPair.length != 0) {
    return existingPair[0].id;
  }

  const newPair = await prisma.playerPair.create({
    data: {
      player_id1: playerPair.player_id1,
      player_id2: playerPair.player_id2,
    },
  });

  return newPair.id;
}
