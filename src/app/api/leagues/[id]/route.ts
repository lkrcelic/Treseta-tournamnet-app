import {LeagueUpdateRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {updateLeague} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Change a league's name and details (admin, Manage League)
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  try {
    const body = LeagueUpdateRequestValidation.parse(await request.json());
    if (!(await updateLeague(leagueId, body))) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    return NextResponse.json({league_id: leagueId, ...body}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to update the league.");
  }
}
