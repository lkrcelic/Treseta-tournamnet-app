import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {restoreTable} from "@/app/_lib/service/tournament/attendance";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseUnlessMine, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// Vrati stol (admin or the organizer whose tournament it is): a skipped table or a no-show is back in play, with its
// excluded teams back in the tournament
export async function POST(request: NextRequest, {params}: {params: {id: string; tableId: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  const tableId = tournamentIdOf(params.tableId);
  if (id == null || tableId == null) return tournamentNotFound();
  try {
    await refuseUnlessMine(id, auth.user);
    await restoreTable(id, tableId, auth.user.id);
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Stol nije vraćen.");
  }
}
