import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {BanRequest, BanRequestValidation, changeBan, liftBan} from "@/app/_lib/service/bans/bans";

// Promijeni (PATCH: a new end, reason and, for a team, players) and Ukini (DELETE; ?igraci=1 also ends the players'
// bans through the team's)
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = BanRequestValidation.parse(await request.json());
    await changeBan(Number(params.id), {until: body.until, reason: body.reason ?? "", player_ids: body.player_ids} as BanRequest, auth.user);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Zabrana nije promijenjena.");
  }
}

export async function DELETE(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    await liftBan(Number(params.id), request.nextUrl.searchParams.get("igraci") === "1", auth.user);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Zabrana nije ukinuta.");
  }
}
