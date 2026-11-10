import {NextRequest, NextResponse} from "next/server";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {searchTeammates} from "@/app/_lib/service/players/search";

export const dynamic = "force-dynamic";

// A teammate for a new team (a tournament's Nova ekipa): players with an account by name or username, as Rejting's
// search (both are public, #88), without the player searching
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  try {
    const players = await searchTeammates(request.nextUrl.searchParams.get("q") ?? "", auth.user);
    return NextResponse.json(players, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Igrači se nisu učitali.");
  }
}
