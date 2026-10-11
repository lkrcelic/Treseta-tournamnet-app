import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {matchTeams, TeamPair} from "@/app/_lib/matching/multipleRoundMatching";
import {getLeagueTeamsWithScores} from "@/app/_lib/helpers/query/leagueScores";
import {RoundCreateRequestValidation} from "@/app/_interfaces/round";
import {insertRoundBatch} from "@/app/_lib/service/round/insertPairRounds";
import {errorResponse} from "@/app/_lib/apiErrors";
import {prisma} from "@/app/_lib/prisma";
import {requireAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const searchParams = request.nextUrl.searchParams;

    const roundDate = searchParams.get('round_date');
    // open = the round isn't finished; active = one of its matches is being played right now
    const open = searchParams.get('open');
    const active = searchParams.get('active');
    const roundNumber = searchParams.get('round_number');
    const teamId = searchParams.get('team_id');
    const leagueId = searchParams.get('league_id');

    const whereClause: Record<string, unknown> = {};
    const includeExtra: Record<string, unknown> = {};

    if (roundDate) {
      const dateStr = new Date(roundDate).toISOString().split('T')[0];
      whereClause.round_date = {
        equals: new Date(dateStr)
      };

      includeExtra.ongoingMatches = {
        select: {
          id: true,
          player_pair1_score: true,
          player_pair2_score: true,
          },
        };
    }

    if (open !== null) {
      whereClause.open = open === 'true';
    }

    if (active !== null) {
      whereClause.active = active === 'true';
    }

    if (roundNumber) {
      whereClause.round_number = parseInt(roundNumber);
    }

    if (teamId) {
      const teamIdNum = parseInt(teamId);
      whereClause.OR = [
        {team1_id: teamIdNum},
        {team2_id: teamIdNum}
      ];
    }

    if (leagueId) {
      whereClause.leagueRounds = {
        some: {
          league_id: parseInt(leagueId)
        }
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
      orderBy: [
        {round_number: 'asc'},
        {id: 'asc'}
      ],
    });

    return NextResponse.json(rounds, {status: STATUS.OK});
  } catch (error) {
    console.error("Error fetching rounds:", error);
    return NextResponse.json({error: "Failed to fetch rounds."}, {status: STATUS.BadRequest});
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const createRound = RoundCreateRequestValidation.parse(body);
    const {league_id, present_teams} = createRound;

    const teamsWithScores = await getLeagueTeamsWithScores(league_id);

    const filteredTeams = teamsWithScores.filter((team) => present_teams.includes(team.id));
    let matches: TeamPair[];
    try {
      matches = matchTeams(filteredTeams);
    } catch (error) {
      return NextResponse.json({error: (error as Error).message}, {status: STATUS.BadRequest});
    }

    const {firstRoundNumber, alreadyCreated} = await insertRoundBatch([matches], league_id);

    return NextResponse.json(
      {round_number: firstRoundNumber, already_created: alreadyCreated},
      {status: alreadyCreated ? STATUS.OK : STATUS.Created}
    );
  } catch (error) {
    return errorResponse(error, "Failed to create rounds.");
  }
}
