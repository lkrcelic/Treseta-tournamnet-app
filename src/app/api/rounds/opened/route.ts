import { getAuthorizedUser } from "@/app/_lib/auth";
import roundService from "@/app/_lib/service/round";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthorizedUser(request);

  try {
    const round = await roundService.getLastOpenRoundByPlayerId(Number(user.id))

    return NextResponse.json(round, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Failed to fetch opened round by player id."}, {status: STATUS.BadRequest});
  }
  
}
