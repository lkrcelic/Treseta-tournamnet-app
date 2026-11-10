import {NextRequest, NextResponse} from "next/server";
import {z} from "zod";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {banPlayer, BanRequest, BanRequestValidation, banTeam, playerBanState, teamBanState} from "@/app/_lib/service/bans/bans";

export const dynamic = "force-dynamic";

// Zabrana prijava (admin). GET ?team_id= or ?player_id=: the ban in force and the bans of the team's players (or the
// player's teams). POST {team_id | player_id, until, reason, player_ids}: a new ban.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const q = request.nextUrl.searchParams;
    const teamId = Number(q.get("team_id"));
    const playerId = Number(q.get("player_id"));
    if (Number.isInteger(teamId) && teamId > 0) return NextResponse.json(await teamBanState(teamId), {status: STATUS.OK});
    if (Number.isInteger(playerId) && playerId > 0) return NextResponse.json(await playerBanState(playerId), {status: STATUS.OK});
    return NextResponse.json({error: "Odaberi ekipu ili igrača."}, {status: STATUS.BadRequest});
  } catch (error) {
    return errorResponse(error, "Zabrana se nije učitala.");
  }
}

const NewBanValidation = BanRequestValidation.extend({team_id: z.number().int().optional(), player_id: z.number().int().optional()});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = NewBanValidation.parse(await request.json());
    const ban = {until: body.until, reason: body.reason ?? "", player_ids: body.player_ids} as BanRequest;
    if (body.team_id != null) {
      await banTeam(body.team_id, ban, auth.user);
      return NextResponse.json(await teamBanState(body.team_id), {status: STATUS.Created});
    }
    if (body.player_id != null) {
      await banPlayer(body.player_id, ban, auth.user);
      return NextResponse.json(await playerBanState(body.player_id), {status: STATUS.Created});
    }
    return NextResponse.json({error: "Odaberi ekipu ili igrača."}, {status: STATUS.BadRequest});
  } catch (error) {
    return errorResponse(error, "Zabrana nije spremljena.");
  }
}
