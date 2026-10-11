import {LeagueNightAddRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {addLeagueNight, listLeagueNights} from "@/app/_lib/service/league/nights";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// A league's nights, each with whether it has rounds (Raspored, Manage League · Dates). Public, like the season table.
export async function GET(_request: NextRequest, {params}: {params: {id: string}}) {
  try {
    const nights = await listLeagueNights(Number(params.id));
    if (!nights) return NextResponse.json({error: "League not found."}, {status: STATUS.NotFound});
    return NextResponse.json(nights, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to fetch the league nights.");
  }
}

// Add a night (admin)
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const {date} = LeagueNightAddRequestValidation.parse(await request.json());
    await addLeagueNight(Number(params.id), date);
    return NextResponse.json({date, played: false}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Failed to add the night.");
  }
}
