import {prisma} from "@/app/_lib/prisma";
import {TeamScore} from "@prisma/client";

export async function getLeagueStandings(league_id: number): Promise<TeamScore> {
  const standings = await prisma.teamScore.findMany({
    include: {
      team: {
        select: {
          team_name: true,
        },
      },
    },
    where: {
      league_id: league_id,
      team_id: {
        not: Number(process.env.BYE_ID),
      },
    },
    orderBy: [
      {score: 'desc'},
      {point_difference: 'desc'},
    ],
  });

  return standings;
}
