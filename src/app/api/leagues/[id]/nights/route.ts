import {LeagueNightAddRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {addLeagueNight, listLeagueNights} from "@/app/_lib/service/league/nights";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// A new response each time: a response body can only be sent once
const leagueNotFound = () => NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});

// A league's nights, each with whether it has rounds and when it starts (Raspored, Upravljanje ligom · Datumi). Public, like the season table.
export async function GET(_request: NextRequest, {params}: {params: {id: string}}) {
  try {
    const leagueId = Number(params.id);
    // an id the database can't hold (also a malformed one) doesn't exist either
    if (!isDbId(leagueId)) return leagueNotFound();
    const nights = await listLeagueNights(leagueId);
    if (!nights) return leagueNotFound();
    return NextResponse.json(nights, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Večeri lige se nisu učitale.");
  }
}

// Add a night, with its own start time and place or the league's (admin)
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const night = LeagueNightAddRequestValidation.parse(await request.json());
    const leagueId = Number(params.id);
    if (!isDbId(leagueId)) return leagueNotFound();
    await addLeagueNight(leagueId, night);
    return NextResponse.json({date: night.date, played: false, rounds: 0, start_time: night.start_time ?? null}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Večer nije dodana.");
  }
}
