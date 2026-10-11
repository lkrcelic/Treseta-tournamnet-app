import {LeagueConferencesRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {getLeagueConferences, setLeagueConferences} from "@/app/_lib/service/league/conferences";
import {leagueExists} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// never cached: an admin's changes show on the next load
export const dynamic = "force-dynamic";

// A league's conferences and which team is in which. Public, like the season table that shows them.
export async function GET(_request: NextRequest, {params}: {params: {id: string}}) {
  const leagueId = Number(params.id);
  try {
    if (!(await leagueExists(leagueId))) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    return NextResponse.json(await getLeagueConferences(leagueId), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to fetch conferences.");
  }
}

// Save the league's whole list of conferences (admin, Manage League · Details); an empty list turns them off
export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  try {
    const {conferences} = LeagueConferencesRequestValidation.parse(await request.json());
    if (!(await setLeagueConferences(leagueId, conferences))) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    return NextResponse.json(await getLeagueConferences(leagueId), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to save the conferences.");
  }
}
