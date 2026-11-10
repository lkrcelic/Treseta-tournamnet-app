import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {cronAuthorized} from "@/app/_lib/cron";
import {expireDueMatches} from "@/app/_lib/service/match/timeLimit";

export const dynamic = "force-dynamic";

// The clock's backup for when nobody has the app open: a scheduler (Vercel Cron, or a pinger such as cron-job.org)
// calls it every minute with `Authorization: Bearer <CRON_SECRET>`, and every match whose Vrijeme partije is up
// closes. Otherwise a match closes the moment someone reads its scorepad, which is enough while anyone is looking.
// Calling it twice, or alongside the scorepads' reads, does nothing more: each match is closed once.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({error: "Nije dopušteno."}, {status: STATUS.Unauthorized});
  }
  try {
    return NextResponse.json({closed_tables: await expireDueMatches()}, {status: STATUS.OK, headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    return errorResponse(error, "Provjera vremena nije uspjela.");
  }
}
