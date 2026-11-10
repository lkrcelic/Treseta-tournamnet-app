import {NextRequest, NextResponse} from "next/server";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {AdminHandValidation, HandKindValidation} from "@/app/_interfaces/adminHand";
import {deleteHand, refuseUnlessMyHand, updateHand} from "@/app/_lib/service/admin/hands";

type Params = {params: {kind: string; resultId: string}};

// The scorepad's hands: the admin on a league night, the organizer on a Kolo of their own tournament
// (refuseUnlessMyHand looks up the table the hand was played at).
// kind: "ongoing" (a hand of the match being played) or "finished" (a hand of a finished match)
export async function PUT(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  try {
    const kind = HandKindValidation.parse(params.kind);
    const hand = AdminHandValidation.parse(await request.json());
    await refuseUnlessMyHand(kind, Number(params.resultId), auth.user);
    await updateHand(kind, Number(params.resultId), hand);
    return NextResponse.json({ok: true}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Igra nije spremljena.");
  }
}

export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  try {
    const kind = HandKindValidation.parse(params.kind);
    await refuseUnlessMyHand(kind, Number(params.resultId), auth.user);
    await deleteHand(kind, Number(params.resultId));
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Igra nije obrisana.");
  }
}
