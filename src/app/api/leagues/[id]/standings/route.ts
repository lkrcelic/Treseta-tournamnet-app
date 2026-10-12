import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLeagueStandings} from "@/app/_lib/service/league/getStandings";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const {id} = params;

  try {
    const teamScores = await getLeagueStandings(Number(id));

    return NextResponse.json(teamScores, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Poredak se nije učitao."}, {status: STATUS.ServerError});
  }
}
