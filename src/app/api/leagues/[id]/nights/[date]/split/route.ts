import {errorResponse} from "@/app/_lib/apiErrors";
import {DATE_FORMAT_ERROR} from "@/app/_interfaces/league";
import {NightSplitRequestValidation} from "@/app/_interfaces/split";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {isIsoDate} from "@/app/_lib/nights";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {nightSplit, setNightSplit} from "@/app/_lib/service/league/split";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// Podjela: which place of a two-place night each team of the league plays at (admin)

// A new response each time: a response body can only be sent once
const nightNotFound = () => NextResponse.json({error: "Liga nema tu večer."}, {status: STATUS.NotFound});

// The night's Podjela: its two places (null at one place), the league's teams with their place, its conferences
export async function GET(request: NextRequest, {params}: {params: {id: string; date: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  if (!isIsoDate(params.date)) return NextResponse.json({error: DATE_FORMAT_ERROR}, {status: STATUS.BadRequest});
  try {
    const leagueId = Number(params.id);
    const split = isDbId(leagueId) ? await nightSplit(leagueId, params.date) : null;
    if (!split) return nightNotFound();
    return NextResponse.json(split, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Podjela ekipa se nije učitala.");
  }
}

// Moves teams to a place, or back to Neraspoređene (slot null). Returns the Podjela as saved and its warnings.
export async function PUT(request: NextRequest, {params}: {params: {id: string; date: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  if (!isIsoDate(params.date)) return NextResponse.json({error: DATE_FORMAT_ERROR}, {status: STATUS.BadRequest});
  try {
    const {teams} = NightSplitRequestValidation.parse(await request.json());
    const leagueId = Number(params.id);
    const result = isDbId(leagueId) ? await setNightSplit(leagueId, params.date, teams) : null;
    if (!result) return nightNotFound();
    return NextResponse.json(result, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Podjela nije spremljena.");
  }
}
