import matchService from "@/app/_lib/service/match";
import roundService from "@/app/_lib/service/round";
import {STATUS} from "@/app/_lib/statusCodes";
import { updateScores } from "@/app/_lib/updateScores";
import {NextRequest, NextResponse} from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const matchIdRaw = body?.matchId;

    if (matchIdRaw === undefined || matchIdRaw === null) {
      return NextResponse.json({error: "matchId is required in request body"}, {status: STATUS.BadRequest});
    }

    const matchId = Number(matchIdRaw);
    if (Number.isNaN(matchId)) {
      return NextResponse.json({error: "matchId must be a number"}, {status: STATUS.BadRequest});
    }

    const match = await matchService.finishMatch(matchId);

    if (match) {
      await roundService.updateRoundWins(match.round_id, match.team1_score, match.team2_score);
      await updateScores(match.round_id);
    }

    return NextResponse.json({message: "Match finished"}, {status: STATUS.OK});
  } catch (error) {
    console.error("Error finishing match: ", error);
    return NextResponse.json({error: "Error finishing match"}, {status: STATUS.BadRequest});
  }
}
