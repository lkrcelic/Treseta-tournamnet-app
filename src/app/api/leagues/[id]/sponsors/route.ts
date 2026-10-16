import {NextRequest, NextResponse} from "next/server";
import {errorResponse} from "@/app/_lib/apiErrors";
import {LeagueSponsorsValidation} from "@/app/_interfaces/sponsor";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {leagueSponsors, setLeagueSponsors} from "@/app/_lib/service/sponsors/sponsors";
import {STATUS} from "@/app/_lib/statusCodes";

export const dynamic = "force-dynamic";

type Params = {params: {id: string}};

// The sponsors a league shows, in their order (public: Početna and the live round show them)
export async function GET(_request: NextRequest, {params}: Params) {
  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return NextResponse.json([], {status: STATUS.OK});
  try {
    return NextResponse.json(await leagueSponsors(leagueId), {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Sponzori lige se nisu učitali."}, {status: STATUS.ServerError});
  }
}

// Upravljanje ligom · Sponzori (admin): the league's sponsors become exactly these, in this order
export async function PUT(request: NextRequest, {params}: Params) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const leagueId = Number(params.id);
  if (!isDbId(leagueId)) return NextResponse.json({error: "Liga ne postoji."}, {status: STATUS.NotFound});

  try {
    const {sponsor_ids} = LeagueSponsorsValidation.parse(await request.json());
    return NextResponse.json(await setLeagueSponsors(leagueId, sponsor_ids), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Sponzori lige nisu spremljeni.");
  }
}
