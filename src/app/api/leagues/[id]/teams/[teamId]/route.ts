import {LeagueTeamUpdateRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {removeTeamFromLeague, setLeagueTeamActive} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Mark a team of the league active or inactive (admin)
export async function PATCH(request: NextRequest, {params}: {params: {id: string; teamId: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const {active} = LeagueTeamUpdateRequestValidation.parse(await request.json());
    const updated = await setLeagueTeamActive(Number(params.id), Number(params.teamId), active);
    if (!updated) return NextResponse.json({error: "The team is not in this league."}, {status: STATUS.NotFound});
    return NextResponse.json({league_id: Number(params.id), team_id: Number(params.teamId), active}, {status: STATUS.OK});
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
    if (!removed) return NextResponse.json({error: "The team is not in this league."}, {status: STATUS.NotFound});
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Failed to remove the team.");
  }
}
