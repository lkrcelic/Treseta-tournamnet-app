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

  // Loop through each pair and create both Round and LeagueRound
  for (let i = 0; i < insertData.length; i++) {
    const roundData = insertData[i];
    const isByeRound = i === byeRoundIndex;

    // If this is a bye round, update the data before creating
    if (isByeRound) {
      if (roundData.team1_id === bye_id) {
        roundData.team2_wins = 2; // Team 2 wins automatically
      } else {
        roundData.team1_wins = 2; // Team 1 wins automatically
      }
      roundData.open = false;
    }

    const createdRound = await prisma.round.create({
      data: roundData,
    });

    // Create LeagueRound entry
    await prisma.leagueRound.create({
      data: {
        league_id: leagueId,
        round_id: createdRound.id,
      },
    });

    // Create automatic matches if this is a bye round
    if (isByeRound) {
      await createByeMatches(createdRound.id, roundData.team1_id, roundData.team2_id, bye_id);
      const nonByeTeamId = roundData.team1_id === bye_id ? roundData.team2_id : roundData.team1_id;
      await prisma.$queryRaw`
      CALL update_team_score(${nonByeTeamId}, ${leagueId})
    `;
    }
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
        player_pair1_score: isByeTeam1 ? 0 : 301, // If bye is team1, team2 (real team) gets points
        player_pair2_score: isByeTeam1 ? 301 : 0, // If bye is team2, team1 (real team) gets points
        score_threshold: 1001,
        match_date: now
      }
    });
  }
}
