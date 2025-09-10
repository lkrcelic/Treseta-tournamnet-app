// src/app/api/teams/route.ts

import {prisma} from "@/app/_lib/prisma";
import {TeamRequestValidation, TeamsResponseValidation} from "@/app/_interfaces/team";
import {z} from "zod";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getAuthorizedUser} from "@/app/_lib/auth";
import {createTeam} from "@/app/_lib/service/team/create";

export async function GET(request: NextRequest) {
  try {
    const {searchParams} = new URL(request.url);
    const search = searchParams.get("search");
    const dbTeams = await prisma.team.findMany({
      where: search
        ? {
            team_name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : undefined,
      include: {
        teamPlayers: {
          include: {player: true},
        },
      },
    });
    const teams = TeamsResponseValidation.parse(dbTeams);

    return NextResponse.json(teams, {status: STATUS.OK});
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json({error: "Failed to fetch teams."}, {status: STATUS.ServerError});
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthorizedUser(request);
    const req_data = await request.json();

    const teamVal = TeamRequestValidation.parse(req_data);

    const createdTeam = await createTeam(teamVal, user.id);

    return NextResponse.json(createdTeam, {status: STATUS.OK});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({error: error.issues}, {status: STATUS.BadRequest});
    }
    return NextResponse.json({error: error}, {status: STATUS.ServerError});
  }
}