import { AddTeammateRequestValidation } from "@/app/_interfaces/team";
import { checkCurrentUserIsAdmin } from "@/app/_lib/auth";
import { addPlayerToTeam } from "@/app/_lib/service/team/addPlayer";
import { STATUS } from "@/app/_lib/statusCodes";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    await checkCurrentUserIsAdmin(request);

    const body = await request.json();
    const parsed = AddTeammateRequestValidation.parse(body);

    const created = await addPlayerToTeam(parsed.team_id, parsed.player_id);

    return NextResponse.json(created, { status: STATUS.OK });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Failed to add teammate", error);
      return NextResponse.json({ error: error.issues }, { status: STATUS.BadRequest });
    }
    console.error("Failed to add teammate", error);
    return NextResponse.json({ error: "Failed to add teammate" }, { status: STATUS.ServerError });
  }
}