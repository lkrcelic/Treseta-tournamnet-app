import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {mySchedule} from "@/app/_lib/service/league/schedule";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// The leagues the logged-in player plays in, with their team and nights (Početna · Sljedeća večer, Raspored, Burza)
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await mySchedule(auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Raspored se nije učitao.");
  }
}
