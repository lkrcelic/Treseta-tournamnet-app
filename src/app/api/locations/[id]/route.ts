import {NextRequest, NextResponse} from "next/server";
import {errorResponse} from "@/app/_lib/apiErrors";
import {LOCATION_NOT_FOUND, LocationUpdateValidation} from "@/app/_interfaces/location";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {deleteLocation, updateLocation} from "@/app/_lib/service/location/locations";
import {STATUS} from "@/app/_lib/statusCodes";
import {isDbId} from "@/app/_lib/helpers/query/dbId";

export const dynamic = "force-dynamic";

type Params = {params: {id: string}};

// a new response each time: a response body can only be sent once
const notFound = () => NextResponse.json({error: LOCATION_NOT_FOUND}, {status: STATUS.NotFound});

// Uredi lokaciju (admin): the change shows wherever the place is used
export async function PATCH(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "location.manage");
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return notFound();

  try {
    const input = LocationUpdateValidation.parse(await request.json());
    return NextResponse.json(await updateLocation(id, input), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Lokacija nije spremljena.");
  }
}

// Obriši lokaciju (admin): only a place nothing uses
export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireCan(request, "location.manage");
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return notFound();

  try {
    await deleteLocation(id);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Lokacija nije obrisana.");
  }
}
