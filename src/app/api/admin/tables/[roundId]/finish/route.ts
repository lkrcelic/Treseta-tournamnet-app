import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {finishTableMatch} from "@/app/_lib/service/admin/hands";
import {MatchAlreadyFinishedError} from "@/app/_lib/service/match/finishOngoingMatch";

// Finishes the match being played at the table
export async function POST(request: NextRequest, {params}: {params: {roundId: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    return NextResponse.json(await finishTableMatch(Number(params.roundId)), {status: STATUS.OK});
  } catch (error) {
    if (error instanceof MatchAlreadyFinishedError) {
      return NextResponse.json({error: error.message}, {status: STATUS.Conflict});
    }
    return errorResponse(error, "Failed to finish the match.");
  }
}
