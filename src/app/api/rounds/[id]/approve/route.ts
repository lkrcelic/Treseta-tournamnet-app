import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {setRoundApproval} from "@/app/_lib/service/round/publication";
import {STATUS} from "@/app/_lib/statusCodes";

// Approves the round (a draft, Upravljanje ligom · Skica) that this table belongs to: all its tables. Approving an
// approved round changes nothing; a published one can't change (400).
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const roundId = Number(params.id);
  if (!isDbId(roundId)) return NextResponse.json({error: "Kolo ne postoji."}, {status: STATUS.NotFound});

  try {
    return NextResponse.json(await setRoundApproval(roundId, true), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Kolo nije odobreno.");
  }
}
