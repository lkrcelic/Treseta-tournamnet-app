// src/app/api/players/[id]/route.ts
import { NextResponse } from "next/server";
import { STATUS } from "@/app/_lib/statusCodes";
import { getPlayerById } from "@/app/_lib/service/players/getById";

// Handle GET request to fetch a single player by ID
export async function GET(
  request: Request,
  {params}: { params: { id: string } }
) {
  const {id} = params;

  try {
    const player = await getPlayerById(Number(id));

    if (!player) {
      return NextResponse.json({error: "Player not found."}, {status: STATUS.NotFound});
    }

    return NextResponse.json(player, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json(
      {error: "Failed to fetch player."},
      {status: STATUS.ServerError}
    );
  }
}