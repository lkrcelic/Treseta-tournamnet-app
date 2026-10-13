import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {setRoundApproval} from "@/app/_lib/service/round/publication";
import {STATUS} from "@/app/_lib/statusCodes";

// Takes back the approval of the round this table belongs to: it is a draft again (Upravljanje ligom · Skica). A draft
// stays a draft; a published round can't change (400).
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const roundId = Number(params.id);
  if (!isDbId(roundId)) return NextResponse.json({error: "Kolo ne postoji."}, {status: STATUS.NotFound});

  try {
    return NextResponse.json(await setRoundApproval(roundId, false), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Odobrenje nije poništeno.");
  }
}
