import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {z} from "zod";
import {signOff} from "@/app/_lib/service/tournament/entries";
import {adminSetActive, adminSetArrival, excludeTeam, restoreTeam} from "@/app/_lib/service/tournament/day";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseIfFinished, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

const TeamDayValidation = z.object({
  // Označi dolazak / Makni potvrdu
  arrived: z.boolean().optional(),
  // the Aktivna switch (on a waiting team: Ubaci u turnir)
  active: z.boolean().optional(),
  // Isključi ekipu / Vrati
  excluded: z.boolean().optional(),
});

// The admin's buttons for a team on the tournament's day: {arrived}, {active} or {excluded}
export async function PATCH(request: NextRequest, {params}: {params: {id: string; teamId: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseIfFinished(id, auth.user);
    const body = TeamDayValidation.parse(await request.json());
    const teamId = Number(params.teamId);
    if (body.arrived !== undefined) await adminSetArrival(id, teamId, body.arrived);
    if (body.active !== undefined) await adminSetActive(id, teamId, body.active);
    if (body.excluded !== undefined) await (body.excluded ? excludeTeam(id, teamId) : restoreTeam(id, teamId));
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Promjena nije spremljena.");
  }
}

// Makni ekipu (admin), without a notice; the first team waiting comes in
export async function DELETE(request: NextRequest, {params}: {params: {id: string; teamId: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseIfFinished(id, auth.user);
    await signOff(id, Number(params.teamId), auth.user);
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Ekipa nije maknuta.");
  }
}
