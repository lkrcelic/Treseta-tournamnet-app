import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {generateMultipleRoundPairings} from "@/app/_lib/matching/multipleRoundMatching";
import {getLeagueTeamsWithScores} from "@/app/_lib/helpers/query/leagueScores";
import {CreateRound} from "@/app/_interfaces/round";
import {checkCurrentUserIsAdmin} from "@/app/_lib/auth";
import {insertPairRounds} from "@/app/_lib/service/round/insertPairRounds";

export async function POST(request: NextRequest) {
  try {
    const isUserAdmin = await checkCurrentUserIsAdmin(request as NextRequest);
    if (!isUserAdmin) {
      return NextResponse.json("You are not authorized for this action.", {status: STATUS.Unauthorized});
    }

    const body = await request.json();
    const createRound = CreateRound.parse(body);
    const {league_id, present_teams} = createRound;

    const teamsWithScores = await getLeagueTeamsWithScores(league_id);

    const filteredTeams = teamsWithScores.filter((team) => present_teams.includes(team.id));
    
    // Generate multiple rounds with hardcoded values (3 rounds, window size 6)
    const allRoundPairings = generateMultipleRoundPairings(filteredTeams, {
      windowSize: 6,
      numberOfRounds: 3
    });

    // Insert each round of pairings
    let firstRoundNumber = 0;
    for (let i = 0; i < allRoundPairings.length; i++) {
      const roundNumber = await insertPairRounds(allRoundPairings[i], league_id);
      if (i === 0) {
        firstRoundNumber = roundNumber;
      }
    }

    return NextResponse.json({round_number: firstRoundNumber}, {status: STATUS.Created});
  } catch (error) {
    console.error("Error creating rounds:", error);
    return NextResponse.json({error: "Failed to create rounds."}, {status: STATUS.ServerError});
  }
}
