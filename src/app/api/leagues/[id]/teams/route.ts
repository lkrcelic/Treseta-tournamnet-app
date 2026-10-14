import {LeagueTeamAddRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {addTeamToLeague, leagueExists, listLeagueTeams} from "@/app/_lib/service/league/leagues";
import {teamSmokers} from "@/app/_lib/service/team/smokers";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// A new response each time: a response body can only be sent once
const leagueNotFound = () => NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});

// Teams of a league with their players and active flag (admin: Manage League, Create Round)
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  // an id the database can't hold (also a malformed one) doesn't exist either
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    if (!(await leagueExists(leagueId))) return leagueNotFound();
    return NextResponse.json(await listLeagueTeams(leagueId), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Ekipe se nisu učitale.");
  }
}

// Add an existing team to the league (admin); with its smokers, so Novo kolo counts them for the smoking tables at once
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    if (!(await leagueExists(leagueId))) return leagueNotFound();
    const {team_id} = LeagueTeamAddRequestValidation.parse(await request.json());
    await addTeamToLeague(leagueId, team_id);
    const smokers = (await teamSmokers([team_id])).get(team_id) ?? 0;
    return NextResponse.json({league_id: leagueId, team_id, active: true, smokers}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Ekipa nije dodana.");
  }
}
