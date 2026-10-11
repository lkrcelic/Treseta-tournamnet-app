// src/app/api/matches/route.ts

import {prisma} from "@/app/_lib/prisma";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {MatchRequestValidation} from "@/app/_interfaces/match";
import {finishOngoingMatch, MatchAlreadyFinishedError} from "@/app/_lib/service/match/finishOngoingMatch";
import {canPlayRound, notYourRoundResponse, requireAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {getRoundIdOfOngoingMatch} from "@/app/_lib/service/ongoingMatch/getRoundId";
import {errorResponse} from "@/app/_lib/apiErrors";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    // TODO?: implement limit/offset
    const allMatches = await prisma.match.findMany();

    return NextResponse.json(allMatches, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json({error: "Failed to fetch matches."}, {status: STATUS.ServerError});
  }
}

// Finishes an ongoing match. Responds with what happens next:
// {roundId, roundFinished, nextOngoingMatchId} - either the next match to play or the finished round.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const req_data = await request.json();
    const ongoingMatchId = MatchRequestValidation.parse(req_data);

    const roundId = await getRoundIdOfOngoingMatch(ongoingMatchId);
    if (roundId === undefined) {
      return NextResponse.json({error: new MatchAlreadyFinishedError().message}, {status: STATUS.Conflict});
    }
    if (!(await canPlayRound(auth.user, roundId))) {
      return notYourRoundResponse();
    }

    const outcome = await finishOngoingMatch(ongoingMatchId);

    return NextResponse.json(outcome, {status: STATUS.OK});
  } catch (error) {
    if (error instanceof MatchAlreadyFinishedError) {
      return NextResponse.json({error: error.message}, {status: STATUS.Conflict});
    }
    return errorResponse(error, "Failed to finish the match.");
  }
}
