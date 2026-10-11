import {LeagueNotesRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {getLeagueNotes, setLeagueNotes} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// The admins' notes of a league, next to Create Round (admin only; the league list itself is public)
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const notes = await getLeagueNotes(Number(params.id));
    if (notes == null) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    return NextResponse.json({notes}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to fetch the notes.");
  }
}

export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const {notes} = LeagueNotesRequestValidation.parse(await request.json());
    if (!(await setLeagueNotes(Number(params.id), notes))) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    return NextResponse.json({notes}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to save the notes.");
  }
}
