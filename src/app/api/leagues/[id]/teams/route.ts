import {LeagueTeamAddRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {addTeamToLeague, leagueExists, listLeagueTeams} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Teams of a league with their players and active flag (admin: Manage League, Create Round)
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  try {
    if (!(await leagueExists(leagueId))) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    return NextResponse.json(await listLeagueTeams(leagueId), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to fetch teams.");
  }
}

// Add an existing team to the league (admin)
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  try {
    if (!(await leagueExists(leagueId))) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    const {team_id} = LeagueTeamAddRequestValidation.parse(await request.json());
    await addTeamToLeague(leagueId, team_id);
    return NextResponse.json({league_id: leagueId, team_id, active: true}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Failed to add the team.");
  }
}
