import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {attentionFor} from "@/app/_lib/service/tournament/attention";
import {NO_STORE} from "@/app/_lib/service/tournament/routes";

export const dynamic = "force-dynamic";

// A player's app asks this on every screen: the question about their table (Jesu li … za stolom?) and the notice of a
// skipped match, and when to ask again
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    return NextResponse.json(await attentionFor(auth.user), {status: STATUS.OK, headers: NO_STORE});
  } catch (error) {
    return errorResponse(error, "Provjera stola nije uspjela.");
  }
}
