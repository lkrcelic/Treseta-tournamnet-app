import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";
import matchService from "@/app/_lib/service/match";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const matches = await matchService.getAllMatchesByQuery(searchParams);

    return NextResponse.json(matches, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json({error: "Failed to fetch matches."}, {status: STATUS.ServerError});
  }
}
