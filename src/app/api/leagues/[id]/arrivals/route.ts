import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {LeagueArrivalsRequestValidation} from "@/app/_interfaces/leagueArrival";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {leagueArrivals, setArrivals} from "@/app/_lib/service/league/arrival";
import {leagueExists} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// A new response each time: a response body can only be sent once
const leagueNotFound = () => NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});
const NO_STORE = {"Cache-Control": "no-store"};

// Novo kolo on a night with Potvrda dolaska (DECISIONS #73): tonight's window ({window: null}: none tonight) and every
// team that came, asked again while the admin is on Novo kolo
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    if (!(await leagueExists(leagueId))) return leagueNotFound();
    return NextResponse.json(await leagueArrivals(leagueId), {status: STATUS.OK, headers: NO_STORE});
  } catch (error) {
    return errorResponse(error, "Dolasci se nisu učitali.");
  }
}

// The admin's switches there: these teams are here (Označi dolazak, for a team without a phone) or not
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return leagueNotFound();
  try {
    if (!(await leagueExists(leagueId))) return leagueNotFound();
    const {team_ids, here} = LeagueArrivalsRequestValidation.parse(await request.json());
    return NextResponse.json(await setArrivals(leagueId, team_ids, here), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Nije spremljeno.");
  }
}
