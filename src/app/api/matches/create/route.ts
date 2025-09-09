import matchService from "@/app/_lib/service/match";
import roundService from "@/app/_lib/service/round";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const req_data = await request.json();
    
    const match = await matchService.createMatch(req_data);

    await roundService.activateRound(match.round_id);

    return NextResponse.json({id: match.id}, {status: STATUS.OK});
  } catch (error) {
    console.error("Failed to create match:", error);
    return NextResponse.json({error: "Failed to create match"}, {status: STATUS.ServerError});
  }
}
