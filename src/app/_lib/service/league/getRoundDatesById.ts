import { prisma } from "@/app/_lib/prisma";

export async function getRoundDatesByLeagueId(league_id: number): Promise<string[]> {
  const rounds = await prisma.round.findMany({
    where: {
      leagueRounds: {
        every: {
          league_id: league_id,
        },
      },
    },
    select: {
      round_date: true,
    },
    orderBy: [{ round_date: "asc" }],
    distinct: ["round_date"],
  });

  // Normalize to YYYY-MM-DD strings
  const dates = rounds
    .map((r) => new Date(r.round_date as unknown as string).toISOString().split("T")[0])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return dates;
}
