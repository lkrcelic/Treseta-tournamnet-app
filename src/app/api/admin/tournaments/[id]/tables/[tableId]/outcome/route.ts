import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {setTableOutcome} from "@/app/_lib/service/tournament/attendance";
import {getAdminTournament} from "@/app/_lib/service/tournament/tournaments";
import {refuseUnlessMine, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

const OutcomeValidation = z.object({outcome: z.enum(["TEAM1", "TEAM2", "SKIPPED"], {errorMap: () => ({message: "Nepoznat ishod."})})});

// Uredi ishod (admin or the organizer whose tournament it is): a skipped table or a no-show gets the result picked,
// {outcome: "TEAM1" | "TEAM2" | "SKIPPED"}
export async function POST(request: NextRequest, {params}: {params: {id: string; tableId: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  const tableId = tournamentIdOf(params.tableId);
  if (id == null || tableId == null) return tournamentNotFound();
  try {
    await refuseUnlessMine(id, auth.user);
    const {outcome} = OutcomeValidation.parse(await request.json());
    await setTableOutcome(id, tableId, outcome, auth.user.id);
    return NextResponse.json(await getAdminTournament(id, auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Ishod nije spremljen.");
  }
}
