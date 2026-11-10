import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {signOff} from "@/app/_lib/service/tournament/entries";
import {tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// A player of the team signs it off (Odjavi se s turnira), before the tournament starts; the first team waiting comes in
export async function DELETE(request: NextRequest, {params}: {params: {id: string; teamId: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await signOff(id, Number(params.teamId), auth.user);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Ekipa nije odjavljena.");
  }
}
