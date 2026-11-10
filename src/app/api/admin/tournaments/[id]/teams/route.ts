import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {TeamIdValidation} from "@/app/_interfaces/tournament";
import {adminAddTeam} from "@/app/_lib/service/tournament/entries";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseIfFinished, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// Dodaj ekipu (admin): in while there is room, else on the waiting list
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseIfFinished(id, auth.user);
    const {team_id} = TeamIdValidation.parse(await request.json());
    await adminAddTeam(id, team_id);
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Ekipa nije dodana.");
  }
}
