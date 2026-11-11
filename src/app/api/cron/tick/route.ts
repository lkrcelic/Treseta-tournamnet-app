import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {cronAuthorized} from "@/app/_lib/cron";
import {NO_STORE} from "@/app/_lib/service/tournament/routes";
import {tick} from "@/app/_lib/service/tournament/clock";

export const dynamic = "force-dynamic";

// The clock's backup for when nobody has the app open: a scheduler (Vercel Cron, or a pinger such as cron-job.org)
// calls it every minute with `Authorization: Bearer <CRON_SECRET>`. Today's tournaments run what is due and every match
// out of time closes, the league's too. Calling it twice, or alongside the pages' reads, does nothing more: each step
// happens once.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({error: "Nije dopušteno."}, {status: STATUS.Unauthorized});
  }
  try {
    return NextResponse.json(await tick(), {status: STATUS.OK, headers: NO_STORE});
  } catch (error) {
    return errorResponse(error, "Provjera vremena nije uspjela.");
  }
}
