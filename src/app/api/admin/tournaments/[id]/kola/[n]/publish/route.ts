import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {publishKolo, STALE_DRAFT, StaleDraftError} from "@/app/_lib/service/tournament/kola";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseUnlessMine, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// Objavi kolo (admin): the Kolo's draft goes out to the players; Kolo 1 starts the tournament
export async function POST(request: NextRequest, {params}: {params: {id: string; n: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseUnlessMine(id, auth.user);
    await publishKolo(id, Number(params.n));
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    if (error instanceof StaleDraftError) return NextResponse.json({error: error.message, code: STALE_DRAFT}, {status: STATUS.Conflict});
    return errorResponse(error, "Kolo nije objavljeno.");
  }
}
