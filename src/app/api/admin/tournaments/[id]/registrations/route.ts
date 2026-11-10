import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {RegistrationsOpenValidation} from "@/app/_interfaces/tournament";
import {setRegistrationsOpen} from "@/app/_lib/service/tournament/entries";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseUnlessMine, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// Prijave otvorene / zatvorene (admin), before the tournament starts
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseUnlessMine(id, auth.user);
    const {open} = RegistrationsOpenValidation.parse(await request.json());
    await setRegistrationsOpen(id, open);
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Prijave nisu promijenjene.");
  }
}
