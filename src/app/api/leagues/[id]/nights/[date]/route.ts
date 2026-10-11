import {errorResponse} from "@/app/_lib/apiErrors";
import {isIsoDate} from "@/app/_lib/nights";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {removeLeagueNight} from "@/app/_lib/service/league/nights";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Remove a night that has no rounds (admin)
export async function DELETE(request: NextRequest, {params}: {params: {id: string; date: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  if (!isIsoDate(params.date)) return NextResponse.json({error: "Use the YYYY-MM-DD format."}, {status: STATUS.BadRequest});

  try {
    if (!(await removeLeagueNight(Number(params.id), params.date))) {
      return NextResponse.json({error: "The league doesn't have this night."}, {status: STATUS.NotFound});
    }
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Failed to remove the night.");
  }
}
