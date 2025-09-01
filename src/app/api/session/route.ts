import {getAuthorizedUser} from "@/app/_lib/auth";
import {GoogleSessionsOut, LuciaSessionsOut} from "@/app/_interfaces/session";
import {prisma} from "@/app/_lib/prisma";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export async function GET(req: NextRequest) {
  try {
    // TODO: Enable so that only the admin can see running sessions!
    const user = await getAuthorizedUser(req);
    if (!user || user.player_role !== "ADMIN") {
      return NextResponse.json({message: "You are not authorized for this action."},
        {status: STATUS.NotAllowed});
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