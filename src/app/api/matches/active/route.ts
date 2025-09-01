import { getAuthorizedUser } from "@/app/_lib/auth";
import { getActiveMatchByRoundId } from "@/app/_lib/service/match/getActiveMatchByRoundId";
import { getLastOpenRoundByPlayerId } from "@/app/_lib/service/round/getLastOpenByPlayerId";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);

  try {
    const round = await getLastOpenRoundByPlayerId(Number(user.id));

    const activeMatch = await getActiveMatchByRoundId(round.id);

    if (!activeMatch) {
      return NextResponse.json({ error: 'No active match' }, { status: STATUS.NotFound });
    }

    return NextResponse.json({ id: activeMatch.id }, { status: STATUS.OK });
  } catch (error) {
    return NextResponse.json({ error: 'No open round found' }, { status: STATUS.NotFound });
  }
}
