import {NextRequest, NextResponse} from "next/server";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {refuseUnlessMyTable} from "@/app/_lib/service/admin/tables";
import {unlockTable} from "@/app/_lib/service/admin/unlock";

type Params = {params: {roundId: string}};

// Otključaj partiju: a locked table of a tournament is played on again, with the tournament's Vrijeme partije from now
// (DECISIONS #89; a body, as an older page sends {minutes}, is ignored). The admin on any tournament, the organizer on
// their own (refuseUnlessMyTable, #86).
export async function PATCH(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const roundId = Number(params.roundId);
  if (!isDbId(roundId)) return NextResponse.json({error: "Stol ne postoji."}, {status: STATUS.NotFound});
  try {
    await refuseUnlessMyTable(roundId, auth.user);
    return NextResponse.json(await unlockTable(roundId, auth.user.id), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Stol nije otključan.");
  }
}
