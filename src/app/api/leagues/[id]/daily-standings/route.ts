import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLeagueStandingsByDate} from "@/app/_lib/service/league/getStandingsByDate";
import {leagueDateString} from "@/app/_lib/dates";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  // nights and round tables need a login; only the season table (/standings) is public
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const {id} = params;
  const searchParams = request.nextUrl.searchParams;
  const dateParam = searchParams.get('date');
  
  // A YYYY-MM-DD date is used as is, without the date shifting through time zones
  const currentDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : leagueDateString();

  try {
    const teamScores = await getLeagueStandingsByDate(Number(id), currentDate);

    return NextResponse.json(teamScores, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Failed to fetch league standings."}, {status: STATUS.ServerError});
  }
}
