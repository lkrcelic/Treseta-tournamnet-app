import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {admitTeam} from "@/app/_lib/service/tournament/entries";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseIfFinished, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// Ubaci u turnir (admin): a team from the waiting list comes in, the limit grows by one
export async function POST(request: NextRequest, {params}: {params: {id: string; teamId: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseIfFinished(id, auth.user);
    await admitTeam(id, Number(params.teamId));
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Ekipa nije ubačena.");
  }
}
