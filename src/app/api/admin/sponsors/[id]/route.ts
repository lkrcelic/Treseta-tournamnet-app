import {NextRequest, NextResponse} from "next/server";
import {errorResponse} from "@/app/_lib/apiErrors";
import {SPONSOR_NOT_FOUND, SponsorUpdateValidation} from "@/app/_interfaces/sponsor";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {deleteSponsor, updateSponsor} from "@/app/_lib/service/sponsors/sponsors";
import {STATUS} from "@/app/_lib/statusCodes";

type Params = {params: {id: string}};

// a new response each time: a response body can only be sent once
const sponsorNotFound = () => NextResponse.json({error: SPONSOR_NOT_FOUND}, {status: STATUS.NotFound});

// Uredi sponzora (admin): what is sent changes, in every league that shows it
export async function PATCH(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return sponsorNotFound();

  try {
    const change = SponsorUpdateValidation.parse(await request.json());
    return NextResponse.json(await updateSponsor(id, change), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Sponzor nije spremljen.");
  }
}

// Obriši sponzora (admin): off the list and out of every league, with its counts
export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return sponsorNotFound();

  try {
    if (!(await deleteSponsor(id))) return sponsorNotFound();
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Sponzor nije obrisan.");
  }
}
