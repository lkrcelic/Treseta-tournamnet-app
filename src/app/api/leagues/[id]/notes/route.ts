import {LeagueNotesRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {getLeagueNotes, setLeagueNotes} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// A new response each time: a response body can only be sent once
const leagueNotFound = () => NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});

// The admins' notes of a league, next to Create Round (admin only; the league list itself is public)
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  // an id the database can't hold (also a malformed one) doesn't exist either
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    const notes = await getLeagueNotes(leagueId);
    if (notes == null) return leagueNotFound();
    return NextResponse.json({notes}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Bilješke se nisu učitale.");
  }
}

export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    const {notes} = LeagueNotesRequestValidation.parse(await request.json());
    if (!(await setLeagueNotes(leagueId, notes))) return leagueNotFound();
    return NextResponse.json({notes}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Bilješke nisu spremljene.");
  }
}
