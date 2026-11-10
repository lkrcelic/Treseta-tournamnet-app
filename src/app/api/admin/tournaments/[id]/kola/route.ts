import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {KoloRequestValidation} from "@/app/_interfaces/tournament";
import {makeKoloDraft} from "@/app/_lib/service/tournament/kola";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseUnlessMine, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// Složi Kolo N, or Složi ponovo ({redo: true}) (admin): the next Kolo's draft. Answers with the tournament and the
// pairs that meet again because nothing else was possible.
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseUnlessMine(id, auth.user);
    const {redo} = KoloRequestValidation.parse(await request.json().catch(() => ({})));
    const made = await makeKoloDraft(id, {redo: !!redo});
    return NextResponse.json({made, tournament: await getAdminTournament(id, auth.user)}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Kolo nije složeno.");
  }
}
