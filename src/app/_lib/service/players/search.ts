import {prisma} from "@/app/_lib/prisma";
import {PlayerPartialResponse, PlayerPartialResponseArrayValidation} from "@/app/_interfaces/player";

// Every word of the query must match the username, first name or last name ("marko mar" finds Marko Marković)
export async function searchPlayers(query: string): Promise<PlayerPartialResponse[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  const players = await prisma.player.findMany({
    where: {
      AND: words.map((word) => ({
        OR: [
          {username: {contains: word, mode: "insensitive" as const}},
          {first_name: {contains: word, mode: "insensitive" as const}},
          {last_name: {contains: word, mode: "insensitive" as const}},
        ],
      })),
    },
    orderBy: {username: "asc"},
    // the search lists show a few at a time with "Load more"
    take: 100,
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