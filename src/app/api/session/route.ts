import {getAuthorizedUser} from "@/app/_lib/service/auth/getAuthorizedUser";
import {GoogleSessionsOut, LuciaSessionsOut} from "@/app/_interfaces/session";
import {prisma} from "@/app/_lib/prisma";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthorizedUser(req);
    if (!user || user.player_role !== "ADMIN") {
      return NextResponse.json({error: "You are not authorized for this action."},
        {status: user ? STATUS.Forbidden : STATUS.Unauthorized});
    }

    const luciaSessions = LuciaSessionsOut.parse(await prisma.luciaSession.findMany({
      include: {
        player: true
      }
    }));

    const googleSessions = GoogleSessionsOut.parse(await prisma.session.findMany({
      include: {
        user: true
      }
    }));
    return NextResponse.json({luciaSessions, googleSessions}, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Error"}, {status: STATUS.ServerError});
  }
}