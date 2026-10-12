import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {lookupErrorResponse} from "@/app/_lib/apiErrors";
import {getPlayerOverview} from "@/app/_lib/service/players/overview";
import {PLAYER_NOT_FOUND} from "@/app/_interfaces/player";

export const dynamic = "force-dynamic";

// The Player page: the player (personal data only for the player themself and admins), rating, teams and last nights.
// 404 for a player who doesn't exist or was deleted.
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const overview = await getPlayerOverview(Number(params.id), auth.user);
    if (!overview) return NextResponse.json({error: PLAYER_NOT_FOUND}, {status: STATUS.NotFound});
    return NextResponse.json(overview, {status: STATUS.OK});
  } catch (error) {
    return lookupErrorResponse(error, "Igrač se nije učitao.");
  }
}
