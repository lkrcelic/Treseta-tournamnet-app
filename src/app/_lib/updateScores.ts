import {prisma} from "@/app/_lib/prisma";
import {TeamScore} from "@prisma/client";

export interface UpdateScoreParameters {
  roundId: number;
  leagueId?: number | undefined;
}

async function getTeamScores(params: UpdateScoreParameters, teamIds: number[]): Promise<TeamScore[]> {
  let existingScores: TeamScore[] = [];
  if (params.leagueId) {
    existingScores = await prisma.teamScore.findMany({
      where: {team_id: {in: teamIds}, league_id: params.leagueId},
    });
  }
  
  return existingScores;
}

async function checkAndCreateTeamScores(
  params: UpdateScoreParameters,
  teamIds: number[],
  existingScores: TeamScore[]
): Promise<TeamScore[]> {
  if (existingScores.length === 2) return existingScores;

  const existing_ids = existingScores.map((score) => score.team_id);
  const to_create = teamIds.filter((id) => !existing_ids.includes(id));

  const teamScores = to_create.map((id) =>
    params.leagueId ? {team_id: id, league_id: params.leagueId} : {team_id: id}
  );

  if (teamScores.length > 0) await prisma.teamScore.createMany({data: teamScores});

  return await getTeamScores(params, teamIds);
}

export async function updateScores(roundId: number): Promise<void> {
  try {
    // TODO: Why is does round have m2m connections to tournament and league???
    const round = await prisma.round.findUnique({
      where: {id: roundId},
      include: {leagueRounds: true},
    });

    if (!round) {
      console.error("Round not found");
      throw new Error("Round not found");
    };

    const params: UpdateScoreParameters = {
      roundId: roundId,
      leagueId: round.leagueRounds[0].league_id,
    };

    if (!params.leagueId) {
      console.error("League not found");
      throw new Error("League not found");
    };

    const teamIds: number[] = [round.team1_id, round.team2_id];

    const existingScores = await getTeamScores(params, teamIds);
    checkAndCreateTeamScores(params, teamIds, existingScores);

    const scoreTeam1 = existingScores.find((item) => item.team_id == round.team1_id);
    const scoreTeam2 = existingScores.find((item) => item.team_id == round.team2_id);
    if (!scoreTeam1 || !scoreTeam2) {
      console.error("Could not update team scores");
      return;
    }

    const t1_wins = round.team1_wins;
    switch (t1_wins) {
      case 0: {
        // team 2 won both matches
        scoreTeam2.score += 2;
        break;
      }
      case 1: {
        // team1 won 1, team2 won 1
        scoreTeam1.score += 1;
        scoreTeam2.score += 1;
        break;
      }
      case 2: {
        // team1 won both matches
        scoreTeam1.score += 2;
        break;
      }
      default: {
        break;
      }
    }

    await prisma.$transaction([
      prisma.teamScore.update({where: {id: scoreTeam1.id}, data: {score: scoreTeam1.score}}),
      prisma.teamScore.update({where: {id: scoreTeam2.id}, data: {score: scoreTeam2.score}}),
    ]);
  } catch (error) {
    console.error(error);
  }
}
