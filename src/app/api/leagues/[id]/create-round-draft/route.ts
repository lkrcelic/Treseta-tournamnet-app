import {errorResponse} from "@/app/_lib/apiErrors";
import {CreateRoundDraft, CreateRoundDraftValidation} from "@/app/_lib/createRoundDraft";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {getCreateRoundDraft, saveCreateRoundDraft} from "@/app/_lib/service/round/createRoundDraft";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// A new response each time: a response body can only be sent once
const leagueNotFound = () => NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});

// The logged-in admin's Novo kolo for the league tonight ({draft: null} when they haven't changed anything tonight);
// every admin has their own
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  // an id the database can't hold (also a malformed one) doesn't exist either
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    return NextResponse.json({draft: await getCreateRoundDraft(auth.user.id, leagueId)}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Odabir za novo kolo se nije učitao.");
  }
}

export async function PUT(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    const draft = CreateRoundDraftValidation.parse(await request.json()) as CreateRoundDraft;
    if (!(await saveCreateRoundDraft(auth.user.id, leagueId, draft))) return leagueNotFound();
    return NextResponse.json({draft}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Odabir za novo kolo nije spremljen.");
  }
}
