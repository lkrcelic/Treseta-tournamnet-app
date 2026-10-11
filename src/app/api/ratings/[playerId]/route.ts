import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {getPlayerRating} from "@/app/_lib/service/ratings/ratings";
import {errorResponse} from "@/app/_lib/apiErrors";

export const dynamic = "force-dynamic";

// One player's rating with its history and last nights
export async function GET(request: NextRequest, {params}: {params: {playerId: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await getPlayerRating(Number(params.playerId)), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to load the player's rating.");
  }
}
