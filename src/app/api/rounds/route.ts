import {CreateRoundRequestValidation} from "@/app/_interfaces/round";
import {checkCurrentUserIsAdmin} from "@/app/_lib/auth";
import {getLeagueTeamsWithScores} from "@/app/_lib/helpers/query/leagueScores";
import {matchTeams} from "@/app/_lib/matching/multipleRoundMatching";
import {prisma} from "@/app/_lib/prisma";
import {insertPairRounds} from "@/app/_lib/service/round/insertPairRounds";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const roundDate = searchParams.get("round_date");
    const open = searchParams.get("open");
    const roundNumber = searchParams.get("round_number");
    const teamId = searchParams.get("team_id");
    const leagueId = searchParams.get("league_id");

    const whereClause: Record<string, unknown> = {};
    const includeExtra: Record<string, unknown> = {};

    if (roundDate) {
      const dateStr = new Date(roundDate).toISOString().split("T")[0];
      whereClause.round_date = {
        equals: new Date(dateStr),
      };
      includeExtra.matches = {
          select: {
            id: true,
            team1_score: true,
            team2_score: true,
            active: true,
          },
        };
    }

    if (open !== null) {
      whereClause.active = open === "true";
    }

    if (roundNumber) {
      whereClause.round_number = parseInt(roundNumber);
    }

    if (teamId) {
      const teamIdNum = parseInt(teamId);
      whereClause.OR = [{team1_id: teamIdNum}, {team2_id: teamIdNum}];
    }

    if (leagueId) {
      whereClause.leagueRounds = {
        every: {
          league_id: parseInt(leagueId),
        },
      };
    }

    const rounds = await prisma.round.findMany({
      where: whereClause,
      include: {
        team1: {
          select: {
            team_id: true,
            team_name: true,
          },
        },
        team2: {
          select: {
            team_id: true,
            team_name: true,
          },
        },
        ...(includeExtra as object),
      },
      orderBy: [{round_number: "asc"}, {id: "asc"}],
    });

    return NextResponse.json(rounds, {status: STATUS.OK});
  } catch (error) {
    console.error("Error fetching rounds:", error);
    return NextResponse.json({error: "Failed to fetch rounds."}, {status: STATUS.BadRequest});
  }
}

export async function POST(request: NextRequest) {
  try {
    const isUserAdmin = await checkCurrentUserIsAdmin(request as NextRequest);
    if (!isUserAdmin) {
      return NextResponse.json("You are not authorized for this action.", {status: STATUS.Unauthorized});
    }

    const body = await request.json();
    const createRoundRequest = CreateRoundRequestValidation.parse(body);
    const {league_id, present_teams} = createRoundRequest;

    const teamsWithScores = await getLeagueTeamsWithScores(league_id);

    const filteredTeams = teamsWithScores.filter((team) => present_teams.includes(team.id));
    const matches = matchTeams(filteredTeams);

    const roundNumber = await insertPairRounds(matches, league_id);

    return NextResponse.json({round_number: roundNumber}, {status: STATUS.Created});
  } catch (error) {
    console.error("Error creating rounds:", error);
    return NextResponse.json({error: "Failed to create rounds."}, {status: STATUS.ServerError});
  }
}
