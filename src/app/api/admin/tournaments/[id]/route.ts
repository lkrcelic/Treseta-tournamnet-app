import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin, requireCan} from "@/app/_lib/service/auth/requireUser";
import {TournamentRequest, TournamentRequestValidation} from "@/app/_interfaces/tournament";
import {deleteTournament, getAdminTournament, updateTournament} from "@/app/_lib/service/tournament/tournaments";
import {syncTournament} from "@/app/_lib/service/tournament/clock";
import {refuseUnlessMine, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

export const dynamic = "force-dynamic";

type Params = {params: {id: string}};

// Upravljanje turnirom (admin): the tournament, its entries, waiting list, Kolos (the draft too) and standings. What is
// due runs first (the start time's switch, skipped tables, matches out of time, the next Kolo's draft).
export async function GET(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await syncTournament(id, {force: true});
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Turnir se nije učitao.");
  }
}

// Podaci · Spremi promjene (admin): the whole form
export async function PATCH(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseUnlessMine(id, auth.user);
    await updateTournament(id, TournamentRequestValidation.parse(await request.json()) as TournamentRequest);
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Promjene nisu spremljene.");
  }
}

// Obriši turnir: the admin's only (an organizer has Otkaži), and only before it starts — a tournament carries results
// and ratings
export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await deleteTournament(id);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Turnir nije obrisan.");
  }
}
