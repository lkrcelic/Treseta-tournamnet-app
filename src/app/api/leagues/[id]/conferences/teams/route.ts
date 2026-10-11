import {LeagueTeamConferencesRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {getLeagueConferences, setLeagueTeamConferences} from "@/app/_lib/service/league/conferences";
import {leagueExists} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Put several teams in conferences at once (admin, Manage League · "Distribute evenly"). Answers with the league's
// conferences and teams as they are now.
export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  try {
    if (!(await leagueExists(leagueId))) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    const {teams} = LeagueTeamConferencesRequestValidation.parse(await request.json());
    await setLeagueTeamConferences(leagueId, teams);
    return NextResponse.json(await getLeagueConferences(leagueId), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to save the teams' conferences.");
  }
}
