import {NextRequest, NextResponse} from "next/server";
import {errorResponse} from "@/app/_lib/apiErrors";
import {SponsorEventValidation} from "@/app/_interfaces/sponsor";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {recordSponsorEvent} from "@/app/_lib/service/sponsors/sponsors";
import {STATUS} from "@/app/_lib/statusCodes";

// The sponsors' counts: their logos were shown (Početna, the live round) or a sponsor's page was opened. Only the
// day's total per league is kept, nothing about who looked.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    await recordSponsorEvent(SponsorEventValidation.parse(await request.json()));
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Brojka nije spremljena.");
  }
}
