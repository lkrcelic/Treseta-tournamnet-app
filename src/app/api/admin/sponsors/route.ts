import {NextRequest, NextResponse} from "next/server";
import {errorResponse} from "@/app/_lib/apiErrors";
import {SponsorCreateValidation} from "@/app/_interfaces/sponsor";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {createSponsor, listSponsorsForAdmin} from "@/app/_lib/service/sponsors/sponsors";
import {STATUS} from "@/app/_lib/statusCodes";

export const dynamic = "force-dynamic";

// Sponzori (admin): every sponsor with the leagues that show it and its counts, in all and per league
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await listSponsorsForAdmin(), {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Sponzori se nisu učitali."}, {status: STATUS.ServerError});
  }
}

// A new sponsor with its logo (admin); it isn't in any league until a league picks it
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const input = SponsorCreateValidation.parse(await request.json());
    return NextResponse.json(await createSponsor(input), {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Sponzor nije dodan.");
  }
}
