import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {AdminHandValidation, HandKindValidation} from "@/app/_interfaces/adminHand";
import {deleteHand, updateHand} from "@/app/_lib/service/admin/hands";

type Params = {params: {kind: string; resultId: string}};

// kind: "ongoing" (a hand of the match being played) or "finished" (a hand of a finished match)
export async function PUT(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const kind = HandKindValidation.parse(params.kind);
    const hand = AdminHandValidation.parse(await request.json());
    await updateHand(kind, Number(params.resultId), hand);
    return NextResponse.json({ok: true}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to update the hand.");
  }
}

export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    await deleteHand(HandKindValidation.parse(params.kind), Number(params.resultId));
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Failed to delete the hand.");
  }
}
