import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {RegistrationRequest, RegistrationRequestValidation} from "@/app/_interfaces/tournament";
import {signUp} from "@/app/_lib/service/tournament/entries";
import {tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// A player signs up one of their teams, or a new team of them and a partner ({new_team: {name, partner_id}}); while
// the tournament is full the team goes on the waiting list. Answers with the team and whether it is in or waiting.
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    const body = RegistrationRequestValidation.parse(await request.json()) as RegistrationRequest;
    return NextResponse.json(await signUp(id, auth.user, body), {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Ekipa nije prijavljena.");
  }
}
