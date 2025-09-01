import {prisma} from "@/app/_lib/prisma";

export type RoundMatchup = {
  id: number;
  round_number: number | null;
  round_date: Date | null;
  team1: { team_id: number; team_name: string } | null;
  team2: { team_id: number; team_name: string } | null;
  team1_wins: number;
  team2_wins: number;
  table_number: number;
};

export async function getRoundMatchups(roundNumber: number): Promise<RoundMatchup[] | null> {
  const rounds = await prisma.round.findMany({
    where: {round_number: roundNumber},
    include: {
      team1: {
        select: {
          team_id: true,
          team_name: true
        }
      },
      team2: {
        select: {
          team_id: true,
          team_name: true
        }
      }
    },
  });

  return rounds as RoundMatchup[];
}

export async function getCurrentRoundMatchups(): Promise<RoundMatchup[] | null> {
  const currentRound = await prisma.round.aggregate({
    _max: {round_number: true},
  });

  if (!currentRound._max.round_number) return null;

  return await getRoundMatchups(currentRound._max.round_number);
}
