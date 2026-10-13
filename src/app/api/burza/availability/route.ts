import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {getAvailability} from "@/app/_lib/service/burza/burza";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// The logged-in player's open availability ad and profile phone number (the Burza form fills its number from them)
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await getAvailability(auth.user.id), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Dostupnost se nije učitala.");
  }
}
