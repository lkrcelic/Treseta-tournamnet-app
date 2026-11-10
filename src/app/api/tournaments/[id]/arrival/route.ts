import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {arrivalAction} from "@/app/_lib/service/tournament/day";
import {getTournamentDetail} from "@/app/_lib/service/tournament/tournaments";
import {NO_STORE, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

const ArrivalValidation = z.object({action: z.enum(["confirm", "cancel", "join", "leave"])});

// Potvrda dolaska, by any player of the team for the whole team: confirm (Tu smo), cancel (Ipak otkazujemo), join (Tu
// smo · Želimo uskočiti), leave (Odlazimo). Answers with the tournament's page.
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    const {action} = ArrivalValidation.parse(await request.json());
    await arrivalAction(id, auth.user, action);
    return NextResponse.json(await getTournamentDetail(id, auth.user), {status: STATUS.OK, headers: NO_STORE});
  } catch (error) {
    return errorResponse(error, "Nije spremljeno.");
  }
}
