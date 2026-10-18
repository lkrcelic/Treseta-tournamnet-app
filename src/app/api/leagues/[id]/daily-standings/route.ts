import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getLeagueStandingsByDate} from "@/app/_lib/service/league/getStandingsByDate";
import {leagueDateString} from "@/app/_lib/dates";
import {teamPhotoUrls} from "@/app/_lib/service/players/photos";

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
    // each team's photo for the avatar (the ones this player may see)
    const rows = Array.isArray(teamScores) ? (teamScores as {team_id: number}[]) : [];
    const photos = await teamPhotoUrls(auth.user, rows.map((r) => Number(r.team_id)));

    return NextResponse.json(
      rows.map((r) => ({...r, photo_url: photos.get(Number(r.team_id)) ?? null})),
      {status: STATUS.OK}
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Poredak se nije učitao."}, {status: STATUS.ServerError});
  }
}
