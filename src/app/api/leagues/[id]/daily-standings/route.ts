import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLeagueStandingsByDate} from "@/app/_lib/service/league/getStandingsByDate";

export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const {id} = params;
  const searchParams = request.nextUrl.searchParams;
  const dateParam = searchParams.get('date');
  
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  };
  
  const currentDate = dateParam ? formatDate(new Date(dateParam)) : formatDate(new Date());

  try {
    const teamScores = await getLeagueStandingsByDate(Number(id), currentDate);

    return NextResponse.json(teamScores, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Failed to fetch league standings."}, {status: STATUS.ServerError});
  }
}
