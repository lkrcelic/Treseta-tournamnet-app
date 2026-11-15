import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {smokingPlan} from "@/app/_lib/service/round/smoking";
import {slotParam} from "@/app/_lib/locations";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Tonight's smoking tables and every smoking team's rotation this season (admin: Create Round · Smoking plan); ?slot=:
// tonight's rounds at that place of a two-place night
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  // an id the database can't hold (also a malformed one) doesn't exist either
  if (!isDbId(leagueId)) return NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});
  try {
    return NextResponse.json(await smokingPlan(leagueId, slotParam(request.nextUrl.searchParams.get("slot"))), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Pušački raspored se nije učitao.");
  }
}
