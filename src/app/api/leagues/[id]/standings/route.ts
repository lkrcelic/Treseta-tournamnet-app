import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLeagueStandings} from "@/app/_lib/service/league/getStandings";
import {isDbId} from "@/app/_lib/helpers/query/dbId";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const leagueId = Number(params.id);
  // an id the database can't hold (also a malformed one) doesn't exist either
  if (!isDbId(leagueId)) return NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});

  try {
    const teamScores = await getLeagueStandings(leagueId);

    return NextResponse.json(teamScores, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Poredak se nije učitao."}, {status: STATUS.ServerError});
  }
}
