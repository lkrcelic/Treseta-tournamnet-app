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

  // Normalize to YYYY-MM-DD strings, filter out invalid/epoch
  const dates = rounds
    .map((r) => {
      const raw = r.round_date as unknown as Date | string | number;
      let d: Date;
      if (raw instanceof Date) {
        d = raw;
      } else if (typeof raw === "string" || typeof raw === "number") {
        d = new Date(raw);
      } else {
        return null;
      }
      const time = d.getTime();
      if (!isFinite(time) || time === 0) return null; // exclude invalid or epoch
      return new Date(time).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    })
    .filter((v): v is string => !!v && v !== "1970-01-01")
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return dates;
}
