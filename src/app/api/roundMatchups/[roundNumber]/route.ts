import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getRoundMatchups} from "@/app/_lib/service/round/getRoundMatchups";

export async function GET(request: NextRequest, {params}: {params: {roundNumber: string}}) {
  try {
    const roundNumber = parseInt(params.roundNumber);
    const rounds = await getRoundMatchups(roundNumber);

    if (!rounds) {
      return NextResponse.json({error: "There was an error fetching rounds."}, {status: STATUS.ServerError});
    }

    return NextResponse.json(rounds, {status: STATUS.OK});
  } catch (error) {
    console.error("Error in roundMatchups API route:", error);
    return NextResponse.json({error: "Failed to fetch rounds."}, {status: STATUS.BadRequest});
  }
}
