import {prisma} from "@/app/_lib/prisma";

export async function finishRound(round_id: number): Promise<void> {
   await prisma.round.update({
    where: {
      id: round_id,
    },
    data: {
      open: false,
      active: false,
    },
  });

  const round = await prisma.round.findUnique({
    where: {
      id: round_id,
    },
    include: {
      leagueRounds: {
        select: {
          league_id: true,
        },
      },
    },
  });

  const {team1_id, team2_id, leagueRounds = []} = round;
  const league_id = leagueRounds[0].league_id;

  await prisma.$queryRaw`CALL update_team_score(${team1_id}, ${league_id})`;
  await prisma.$queryRaw`CALL update_team_score(${team2_id}, ${league_id})`;
}
