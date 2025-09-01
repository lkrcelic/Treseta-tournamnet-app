import {prisma} from "@/app/_lib/prisma";
import {PlayerPartialResponseArrayValidation} from "@/app/_interfaces/player";

export async function searchPlayers(query: string): Promise<PlayerPartialResponseArrayValidation> {
  const players = await prisma.player.findMany({
    where: {
      OR: [
        {
          first_name: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          username: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      username: true,
    },
  });

  if (!players) {
    throw new Error("Player not found.");
  }

  return PlayerPartialResponseArrayValidation.parse(players);
}