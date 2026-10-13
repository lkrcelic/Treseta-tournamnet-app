import {NextRequest, NextResponse} from "next/server";
import {DATE_FORMAT_ERROR} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {isIsoDate} from "@/app/_lib/nights";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {discardDraft, getDraftNight} from "@/app/_lib/service/round/publication";
import {STATUS} from "@/app/_lib/statusCodes";

type Params = {params: {id: string; date: string}};

// A new response each time: a response body can only be sent once
const leagueNotFound = () => NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});
const badDate = () => NextResponse.json({error: DATE_FORMAT_ERROR}, {status: STATUS.BadRequest});

// The night's rounds with their tables and status, published or not (Upravljanje ligom · Skica; admin)
export async function GET(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return leagueNotFound();
  if (!isIsoDate(params.date)) return badDate();

  try {
    const night = await getDraftNight(leagueId, params.date);
    if (!night) return NextResponse.json({error: "Ta večer nema kola."}, {status: STATUS.NotFound});
    return NextResponse.json(night, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Kola se nisu učitala.");
  }
}

// "Odbaci skicu": deletes the night's rounds that aren't published (drafts and approved ones); published rounds stay
// (admin)
export async function DELETE(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return leagueNotFound();
  if (!isIsoDate(params.date)) return badDate();

  try {
    return NextResponse.json(await discardDraft(leagueId, params.date), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Skica nije odbačena.");
  }
}
