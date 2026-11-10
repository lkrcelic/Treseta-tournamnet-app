import {NextRequest, NextResponse} from "next/server";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {finishTableMatch} from "@/app/_lib/service/admin/hands";
import {MatchAlreadyFinishedError} from "@/app/_lib/service/match/finishOngoingMatch";
import {afterTableClosed} from "@/app/_lib/service/tournament/kola";
import {refuseUnlessMyTable} from "@/app/_lib/service/admin/tables";

// Finishes the match being played at the table
export async function POST(request: NextRequest, {params}: {params: {roundId: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  try {
    await refuseUnlessMyTable(Number(params.roundId), auth.user);
    const outcome = await finishTableMatch(Number(params.roundId));
    // the last table of a tournament's Kolo: the next Kolo's draft
    if (outcome.roundFinished) await afterTableClosed(outcome.roundId);
    return NextResponse.json(outcome, {status: STATUS.OK});
  } catch (error) {
    if (error instanceof MatchAlreadyFinishedError) {
      return NextResponse.json({error: error.message}, {status: STATUS.Conflict});
    }
    return errorResponse(error, "Meč nije završen.");
  }
}
