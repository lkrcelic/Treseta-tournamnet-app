// src/app/api/teams/route.ts

import {prisma} from "@/app/_lib/prisma";
import {TeamRequestValidation, TeamsResponseValidation} from "@/app/_interfaces/team";
import {Prisma} from "@prisma/client";
import {errorResponse} from "@/app/_lib/apiErrors";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {createTeam} from "@/app/_lib/service/team/create";
import {BYE_TEAM_ID} from "@/app/_lib/bye";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const {searchParams} = new URL(request.url);
    const search = searchParams.get("search");
    const dbTeams = await prisma.team.findMany({
      // the bye placeholder is not a real team
      where: {
        team_id: {not: BYE_TEAM_ID},
        ...(search ? {team_name: {contains: search, mode: "insensitive"}} : {}),
      },
      include: {
        // only the fields the response shows (not emails or password hashes)
        teamPlayers: {
          include: {player: {select: {id: true, username: true, first_name: true, last_name: true}}},
          orderBy: {player: {username: "asc"}},
        },
        leagueTeams: {
          select: {active: true, league: {select: {league_id: true, league_name: true}}},
          orderBy: {league_id: "desc"},
        },
      },
      orderBy: {team_name: "asc"},
    });
    const teams = TeamsResponseValidation.parse(dbTeams);

    return NextResponse.json(teams, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json({error: "Failed to fetch teams."}, {status: STATUS.ServerError});
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const req_data = await request.json();

    const teamVal = TeamRequestValidation.parse(req_data);

    const createdTeam = await createTeam(teamVal, auth.user.id);

    return NextResponse.json(createdTeam, {status: STATUS.OK});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({error: "A team with this name already exists."}, {status: STATUS.BadRequest});
    }
    return errorResponse(error, "Failed to create the team.");
  }
}
