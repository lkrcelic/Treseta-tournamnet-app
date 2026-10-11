import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {listRatings} from "@/app/_lib/service/ratings/ratings";
import {errorResponse} from "@/app/_lib/apiErrors";

export const dynamic = "force-dynamic";

// Every player's rating, highest first, and which row is the viewer's
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await listRatings(auth.user.id), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to load the ratings.");
  }
}
