import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {AdminHandCreateValidation} from "@/app/_interfaces/adminHand";
import {addHand, HandTarget} from "@/app/_lib/service/admin/hands";

// Adds a hand to the match being played at the table (starting it if needed) or to a finished match
export async function POST(request: NextRequest, {params}: {params: {roundId: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const {target, hand} = AdminHandCreateValidation.parse(await request.json());
    await addHand(Number(params.roundId), target as HandTarget, hand);
    return NextResponse.json({ok: true}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Failed to save the hand.");
  }
}
