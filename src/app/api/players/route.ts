// src/app/api/players/route.ts

import {NextRequest, NextResponse} from "next/server";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {getAllPlayers} from "@/app/_lib/service/players/getAll";
import {searchPlayers} from "@/app/_lib/service/players/search";

// Admin only: the players with their usernames and emails. ?query= finds the active players to add to a team.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  const query = new URL(req.url).searchParams.get("query");
  try {
    const players = query ? await searchPlayers(query) : await getAllPlayers();
    return NextResponse.json(players, {status: STATUS.OK});
  } catch (error) {
    console.error(error);
    return NextResponse.json({error: "Igrači se nisu učitali."}, {status: STATUS.ServerError});
  }
}
