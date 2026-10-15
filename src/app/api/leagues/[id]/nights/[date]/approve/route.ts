import {NextRequest, NextResponse} from "next/server";
import {DATE_FORMAT_ERROR} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {isIsoDate} from "@/app/_lib/nights";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {approveNight} from "@/app/_lib/service/round/publication";
import {STATUS} from "@/app/_lib/statusCodes";

// "Odobri sva": approves every draft round of the night in one transaction (admin)
export async function POST(request: NextRequest, {params}: {params: {id: string; date: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});
  if (!isIsoDate(params.date)) return NextResponse.json({error: DATE_FORMAT_ERROR}, {status: STATUS.BadRequest});

  try {
    return NextResponse.json(await approveNight(leagueId, params.date), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Kola nisu odobrena.");
  }
}
