import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {LeagueArrivalRequestValidation} from "@/app/_interfaces/leagueArrival";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {teamArrivalAction} from "@/app/_lib/service/league/arrival";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Potvrda dolaska in the league (DECISIONS #73), by any player of the team for the whole team tonight: confirm (Tu
// smo), leave (Ipak otkazujemo before the start, Odlazimo after it). Answers with the team's card on Početna.
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});
  try {
    const {team_id, action} = LeagueArrivalRequestValidation.parse(await request.json());
    return NextResponse.json(await teamArrivalAction(leagueId, team_id, auth.user, action), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Nije spremljeno.");
  }
}
