import {prisma} from "@/app/_lib/prisma";
import {PlayerPartialResponse, PlayerPartialResponseArrayValidation} from "@/app/_interfaces/player";
import {escapeLike} from "@/app/_lib/helpers/query/anyCase";

// Players to add to a team (admin): every word of the query must match the username, first name or last name
// ("marko mar" finds Marko Marković). Deactivated and deleted players aren't offered.
export async function searchPlayers(query: string): Promise<PlayerPartialResponse[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  // contains is an unescaped ILIKE too: "_" would match any character
  const part = (word: string) => ({contains: escapeLike(word), mode: "insensitive" as const});
  const players = await prisma.player.findMany({
    where: {
      active: true,
      deleted_at: null,
      AND: words.map((word) => ({
        OR: [{username: part(word)}, {first_name: part(word)}, {last_name: part(word)}],
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

  return PlayerPartialResponseArrayValidation.parse(players);
}