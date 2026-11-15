import {NextRequest, NextResponse} from "next/server";
import {errorResponse} from "@/app/_lib/apiErrors";
import {LocationCreateValidation} from "@/app/_interfaces/location";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {createLocation, listLocations} from "@/app/_lib/service/location/locations";
import {STATUS} from "@/app/_lib/statusCodes";

export const dynamic = "force-dynamic";

// Lokacije: every place with what uses it, for the Lokacije page and the place pickers (an admin, or an organizer
// making a tournament)
export async function GET(request: NextRequest) {
  const auth = await requireCan(request, "location.create");
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await listLocations(), {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Lokacije se nisu učitale."}, {status: STATUS.ServerError});
  }
}

// Dodaj lokaciju, or Nova lokacija in a place picker
export async function POST(request: NextRequest) {
  const auth = await requireCan(request, "location.create");
  if (auth.response) return auth.response;

  try {
    const input = LocationCreateValidation.parse(await request.json());
    return NextResponse.json(await createLocation(input), {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Lokacija nije dodana.");
  }
}
