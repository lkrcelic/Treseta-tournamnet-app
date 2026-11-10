import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {TournamentRequest, TournamentRequestValidation} from "@/app/_interfaces/tournament";
import {createTournament, listAdminTournaments} from "@/app/_lib/service/tournament/tournaments";
import {syncToday} from "@/app/_lib/service/tournament/clock";

export const dynamic = "force-dynamic";

// The Turniri list: every tournament for an admin, an organizer's own for an organizer (listAdminTournaments)
export async function GET(request: NextRequest) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  try {
    await syncToday();
    return NextResponse.json(await listAdminTournaments(auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Turniri se nisu učitali.");
  }
}

// Novi turnir (admin or organizer): published at once, sign-ups open, and it belongs to whoever made it
export async function POST(request: NextRequest) {
  const auth = await requireCan(request, "tournament.create");
  if (auth.response) return auth.response;
  try {
    const body = TournamentRequestValidation.parse(await request.json()) as TournamentRequest;
    return NextResponse.json({id: await createTournament(body, auth.user.id)}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Turnir nije kreiran.");
  }
}
