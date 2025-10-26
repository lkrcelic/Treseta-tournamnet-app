import {prisma} from "@/app/_lib/prisma";
import {TeamPair} from "@/app/_lib/matching/multipleRoundMatching";

// Define a type for the round data we're creating
type RoundData = {
  round_number: number;
  round_date: Date;
  team1_id: number;
  team2_id: number;
  table_number: number;
  team1_wins?: number;
  team2_wins?: number;
  open?: boolean;
};

export async function insertPairRounds(pairs: TeamPair[], leagueId: number): Promise<number> {
  const maxRound = await prisma.round.aggregate({_max: {round_number: true}}); //TODO

  const now = new Date();
  const roundNum = (maxRound._max.round_number ?? 0) + 1;

  const insertData: RoundData[] = pairs.map((pair: TeamPair, index) => ({
    round_number: roundNum,
    round_date: now,
    team1_id: pair.teamOne.id,
    team2_id: pair.teamTwo.id,
    table_number: index + 1,
  }));

  // Process bye rounds before database operations
  const bye_id = parseInt(process.env.BYE_ID ?? "0");
  const byeRoundIndex = findByeRoundIndex(insertData, bye_id);

  // Apply bye round logic to data before batch creation
  if (byeRoundIndex !== -1) {
    const byeRound = insertData[byeRoundIndex];
    if (byeRound.team1_id === bye_id) {
      byeRound.team2_wins = 2;
    } else {
      byeRound.team1_wins = 2;
    }
    byeRound.open = false;
  }

  // Batch create all rounds
  await prisma.round.createMany({
    data: insertData,
  });

  // Query back the created rounds to get their IDs
  const createdRounds = await prisma.round.findMany({
    where: {
      round_number: roundNum,
    },
    select: {
      id: true,
    },
  });

  // Batch create league rounds
  await prisma.leagueRound.createMany({
    data: createdRounds.map((round) => ({
      league_id: leagueId,
      round_id: round.id,
    })),
  });

  if (byeRoundIndex !== -1) {
    await createByeMatches(createdRounds[byeRoundIndex].id, insertData[byeRoundIndex].team1_id, insertData[byeRoundIndex].team2_id, bye_id);
    const nonByeTeamId = insertData[byeRoundIndex].team1_id === bye_id ? insertData[byeRoundIndex].team2_id : insertData[byeRoundIndex].team1_id;
    await prisma.$queryRaw`
      CALL update_team_score(${nonByeTeamId}, ${leagueId})
    `;
  }

  return roundNum;
}

/**
 * Find the index of the bye round in the rounds array
 * @param rounds Array of round data
 * @param bye_id ID of the bye team
 * @returns Index of the bye round or -1 if not found
 */
function findByeRoundIndex(rounds: RoundData[], bye_id: number): number {
  return rounds.findIndex((round) => round.team1_id === bye_id || round.team2_id === bye_id);
}

/**
 * Create automatic matches for bye rounds
 * @param roundId ID of the round
 * @param team1Id ID of team 1
 * @param team2Id ID of team 2
 * @param bye_id ID of the bye team
 */
export async function createByeMatches(
  roundId: number,
  team1Id: number,
  team2Id: number,
  bye_id: number = parseInt(process.env.BYE_ID ?? "0")
): Promise<void> {
  const now = new Date();

  const isByeTeam1 = team1Id === bye_id;

  for (let i = 0; i < 2; i++) {
    await prisma.match.create({
      data: {
        round_id: roundId,
        team1_score: isByeTeam1 ? 0 : 5, // If bye is team1, team2 (real team) gets points
        team2_score: isByeTeam1 ? 5 : 0, // If bye is team2, team1 (real team) gets points
        score_threshold: 41,
        match_date: now
      }
    });
  }
}
