import {AvailabilityRequest, AvailabilityRequestValidation} from "@/app/_interfaces/burza";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {getAvailability, setAvailability} from "@/app/_lib/service/burza/burza";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// The logged-in player's "Dostupan sam" and profile phone number (Profil · Burza igrača)
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await getAvailability(auth.user.id), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Dostupnost se nije učitala.");
  }
}

// Switch "Dostupan sam" on or off, or change as what the player is available
export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const body = AvailabilityRequestValidation.parse(await request.json()) as AvailabilityRequest;
    return NextResponse.json(await setAvailability(auth.user.id, body), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Dostupnost nije spremljena.");
  }
}
