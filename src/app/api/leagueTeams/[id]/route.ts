import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {prisma} from "@/app/_lib/prisma";
import {checkCurrentUserIsAdmin} from "@/app/_lib/auth";

export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const {id} = params;

  try {
    const isAdmin = await checkCurrentUserIsAdmin(request);
    if (!isAdmin)
      return NextResponse.json({error: "You are not authorized for this action."}, {status: STATUS.Unauthorized});

    const teams = await prisma.leagueTeam.findMany({where: {league_id: parseInt(id), team_id: {not: Number(process.env.BYE_ID)}}, include: {team: true}});

    return NextResponse.json(teams, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Failed to fetch teams."}, {status: STATUS.BadRequest});
  }
}
