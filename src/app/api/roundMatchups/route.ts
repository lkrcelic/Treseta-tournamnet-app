import {NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getCurrentRoundMatchups} from "@/app/_lib/service/round/getRoundMatchups";

export async function GET() {
  try {
    const rounds = await getCurrentRoundMatchups();
    if (!rounds) return NextResponse.json({error: "There was an error fetching rounds."}, {status: STATUS.ServerError});

    return NextResponse.json(rounds, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json({error: "Failed to fetch rounds."}, {status: STATUS.BadRequest});
  }
}
