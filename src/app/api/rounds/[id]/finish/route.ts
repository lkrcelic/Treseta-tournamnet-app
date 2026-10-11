import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {finishRound} from "@/app/_lib/service/round/finish";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {errorResponse} from "@/app/_lib/apiErrors";

// Rounds finish on their own when the second match is finished; this is for an admin to close one by hand.
export async function POST(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    await finishRound(Number(params.id));

    return NextResponse.json("Round finished", {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to finish the round.");
  }
}
