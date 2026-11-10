import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {getAuthorizedUser} from "@/app/_lib/service/auth/getAuthorizedUser";
import {listTournaments} from "@/app/_lib/service/tournament/tournaments";
import {NO_STORE} from "@/app/_lib/service/tournament/routes";
import {syncToday} from "@/app/_lib/service/tournament/clock";

export const dynamic = "force-dynamic";

// Public; the tournaments for Početna · Turniri and the lists (upcoming, live, finished, cancelled), with the viewer's
// own team when someone is logged in
export async function GET(request: NextRequest) {
  try {
    const viewer = await getAuthorizedUser(request);
    // today's tournaments run what is due (their start, skipped tables, matches out of time) before they are read
    await syncToday();
    return NextResponse.json(await listTournaments(viewer), {status: STATUS.OK, headers: NO_STORE});
  } catch (error) {
    return errorResponse(error, "Turniri se nisu učitali.");
  }
}
