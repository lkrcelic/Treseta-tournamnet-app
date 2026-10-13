import {LeagueTeamUpdateRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {setLeagueTeamConference} from "@/app/_lib/service/league/conferences";
import {removeTeamFromLeague, setLeagueTeamActive} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Mark a team of the league active or inactive, and/or put it in one of the league's conferences (admin)
export async function PATCH(request: NextRequest, {params}: {params: {id: string; teamId: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  const teamId = Number(params.teamId);
  try {
    const body = LeagueTeamUpdateRequestValidation.parse(await request.json());
    const notInLeague = () => NextResponse.json({error: "Ekipa nije u ovoj ligi."}, {status: STATUS.NotFound});
    if (body.conference_id !== undefined && !(await setLeagueTeamConference(leagueId, teamId, body.conference_id))) return notInLeague();
    if (body.active !== undefined && !(await setLeagueTeamActive(leagueId, teamId, body.active))) return notInLeague();
    return NextResponse.json({league_id: leagueId, team_id: teamId, ...body}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to update the team.");
  }
}

// Take a team out of the league (admin). Its rounds stay; the team and its players stay in the app.
export async function DELETE(request: NextRequest, {params}: {params: {id: string; teamId: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const removed = await removeTeamFromLeague(Number(params.id), Number(params.teamId));
    if (!removed) return NextResponse.json({error: "Ekipa nije u ovoj ligi."}, {status: STATUS.NotFound});
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Failed to remove the team.");
  }
}
