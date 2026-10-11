import { AddTeammateRequestValidation } from "@/app/_interfaces/team";
import { errorResponse } from "@/app/_lib/apiErrors";
import { requireAdmin } from "@/app/_lib/service/auth/requireUser";
import { addPlayerToTeam } from "@/app/_lib/service/team/addPlayer";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextRequest, NextResponse } from "next/server";

// Older form of POST /api/teams/:id/players
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const parsed = AddTeammateRequestValidation.parse(await request.json());
    const created = await addPlayerToTeam(parsed.team_id, parsed.player_id);
    return NextResponse.json(created, { status: STATUS.OK });
  } catch (error) {
    return errorResponse(error, "Failed to add teammate");
  }
}
