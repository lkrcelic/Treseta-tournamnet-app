import {errorResponse} from "@/app/_lib/apiErrors";
import {DATE_FORMAT_ERROR, LeagueNightUpdateRequestValidation} from "@/app/_interfaces/league";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {isIsoDate} from "@/app/_lib/nights";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {removeLeagueNight, updateLeagueNight} from "@/app/_lib/service/league/nights";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// A new response each time: a response body can only be sent once
const nightNotFound = () => NextResponse.json({error: "Liga nema tu večer."}, {status: STATUS.NotFound});

// A night's new date, its own start time and place (null: the league's); only a night still to be played (admin).
// Returns the night as Datumi shows it.
export async function PATCH(request: NextRequest, {params}: {params: {id: string; date: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  if (!isIsoDate(params.date)) return NextResponse.json({error: DATE_FORMAT_ERROR}, {status: STATUS.BadRequest});

  try {
    const change = LeagueNightUpdateRequestValidation.parse(await request.json());
    const leagueId = Number(params.id);
    const night = isDbId(leagueId) ? await updateLeagueNight(leagueId, params.date, change) : null;
    if (!night) return nightNotFound();
    return NextResponse.json(night, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Večer nije spremljena.");
  }
}

// Remove a night that has no rounds; ?with_rounds=1 removes a played one with its rounds and results (admin)
export async function DELETE(request: NextRequest, {params}: {params: {id: string; date: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  if (!isIsoDate(params.date)) return NextResponse.json({error: DATE_FORMAT_ERROR}, {status: STATUS.BadRequest});

  try {
    const withRounds = request.nextUrl.searchParams.get("with_rounds") === "1";
    if (!(await removeLeagueNight(Number(params.id), params.date, withRounds))) {
      return nightNotFound();
    }
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Večer nije uklonjena.");
  }
}
