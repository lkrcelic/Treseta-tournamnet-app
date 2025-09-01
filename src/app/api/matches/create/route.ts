import { getAuthorizedUser } from "@/app/_lib/auth";
import { createMatch } from "@/app/_lib/service/match/create";
import { getLastOpenRoundByPlayerId } from "@/app/_lib/service/round/getLastOpenByPlayerId";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const user = await getAuthorizedUser(request);

  try {
    const round = await getLastOpenRoundByPlayerId(Number(user.id));

    const match = await createMatch({
      round_id: round.id,
      team1_id: round.team1_id,
      team2_id: round.team2_id,
      score_threshold: 41,
    });

    return NextResponse.json({ id: match.id }, { status: STATUS.OK });
  } catch (error) {
    return NextResponse.json({ error: 'No open round found' }, { status: STATUS.NotFound });
  }
}
