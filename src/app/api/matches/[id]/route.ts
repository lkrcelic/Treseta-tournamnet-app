import matchService from "@/app/_lib/service/match";
import {STATUS} from "@/app/_lib/statusCodes";
import console from "console";
import {NextResponse} from "next/server";

export async function GET(request: Request, {params}: {params: {id: string}}) {
  const {id} = params;

  try {
    const match = await matchService.getMatchByIdWithResults(Number(id));

    return NextResponse.json(match, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Failed to fetch match."}, {status: STATUS.BadRequest});
  }
}
