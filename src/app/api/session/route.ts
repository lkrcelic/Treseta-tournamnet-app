import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {GoogleSessionsOut, LuciaSessionsOut} from "@/app/_interfaces/session";
import {prisma} from "@/app/_lib/prisma";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Every open login (admin)
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;
  try {
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
    return NextResponse.json({error: "Greška."}, {status: STATUS.ServerError});
  }
}