import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {lookupErrorResponse} from "@/app/_lib/apiErrors";
import {getTeamOverview} from "@/app/_lib/service/team/overview";

export const dynamic = "force-dynamic";

// The Team page: players, leagues and last nights (any logged-in player; usernames only for admins and the player
// themself). 404 for a team that doesn't exist and for the bye team.
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const overview = await getTeamOverview(Number(params.id), auth.user);
    if (!overview) return NextResponse.json({error: "Ekipa ne postoji."}, {status: STATUS.NotFound});
    return NextResponse.json(overview, {status: STATUS.OK});
  } catch (error) {
    return lookupErrorResponse(error, "Ekipa se nije učitala.");
  }
}
