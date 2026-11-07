import {NextRequest, NextResponse} from "next/server";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";
import {STATUS} from "@/app/_lib/statusCodes";
import {AdminHandCreateValidation} from "@/app/_interfaces/adminHand";
import {addHand, HandTarget} from "@/app/_lib/service/admin/hands";
import {refuseUnlessMyTable} from "@/app/_lib/service/admin/tables";

// Adds a hand to the match being played at the table (starting it if needed) or to a finished match. allow_no_winner=1:
// the admin confirmed that a finished match is left without a winner.
export async function POST(request: NextRequest, {params}: {params: {roundId: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  try {
    await refuseUnlessMyTable(Number(params.roundId), auth.user);
    const {target, hand} = AdminHandCreateValidation.parse(await request.json());
    await addHand(Number(params.roundId), target as HandTarget, hand, {allowNoWinner: request.nextUrl.searchParams.get("allow_no_winner") === "1"});
    return NextResponse.json({ok: true}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Igra nije spremljena.");
  }
}
