import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {lookupErrorResponse} from "@/app/_lib/apiErrors";
import {getAuthorizedUser} from "@/app/_lib/service/auth/getAuthorizedUser";
import {getTournamentDetail} from "@/app/_lib/service/tournament/tournaments";
import {NO_STORE, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";
import {syncTournament} from "@/app/_lib/service/tournament/clock";

export const dynamic = "force-dynamic";

// Public; a tournament's page: its details, prizes and teams, and for a logged-in player their entry, the teams they
// could sign up and their result
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    const viewer = await getAuthorizedUser(request);
    await syncTournament(id);
    return NextResponse.json(await getTournamentDetail(id, viewer), {status: STATUS.OK, headers: NO_STORE});
  } catch (error) {
    return lookupErrorResponse(error, "Turnir se nije učitao.");
  }
}
