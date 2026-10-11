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

// Round numbers count up per league, so the league is part of the key
export async function getRoundMatchups(roundNumber: number, leagueId: number): Promise<RoundMatchup[] | null> {
  const rounds = await prisma.round.findMany({
    where: {round_number: roundNumber, leagueRounds: {some: {league_id: leagueId}}},
    orderBy: [{table_number: "asc"}, {id: "asc"}],
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

export async function getCurrentRoundMatchups(leagueId: number): Promise<RoundMatchup[] | null> {
  const currentRound = await prisma.round.aggregate({
    _max: {round_number: true},
    where: {leagueRounds: {some: {league_id: leagueId}}},
  });

  if (!currentRound._max.round_number) return null;

  return await getRoundMatchups(currentRound._max.round_number, leagueId);
}
