import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {prisma} from "@/app/_lib/prisma";
import {requireUser} from "@/app/_lib/service/auth/requireUser";

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
    return NextResponse.json({error: "Kola se nisu učitala."}, {status: STATUS.BadRequest});
  }
}
