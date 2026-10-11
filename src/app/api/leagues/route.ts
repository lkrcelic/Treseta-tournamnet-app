import {LeagueCreateRequestValidation} from "@/app/_interfaces/league";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {createLeague, listLeagues} from "@/app/_lib/service/league/leagues";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// never cached at build time: the list changes when an admin creates a league
export const dynamic = "force-dynamic";

// Every league, for the league pickers. Public: league standings can be viewed without logging in.
export async function GET() {
  try {
    return NextResponse.json(await listLeagues(), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to fetch leagues.");
  }
}

// Create a league (admin)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const body = LeagueCreateRequestValidation.parse(await request.json());
    return NextResponse.json(await createLeague(body), {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Failed to create the league.");
  }
}
