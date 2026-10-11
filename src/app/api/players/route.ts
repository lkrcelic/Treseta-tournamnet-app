// src/app/api/players/route.ts

import {NextRequest, NextResponse} from "next/server";
import {isAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {STATUS} from "@/app/_lib/statusCodes";
import {getAllPlayers} from "@/app/_lib/service/players/getAll";
import {searchPlayers} from "@/app/_lib/service/players/search";

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const query = searchParams.get("query");

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    let players;

    if (query) {
      players = await searchPlayers(query)
    } else {
      // the full list includes emails, so only admins get it
      if (!isAdmin(auth.user)) {
        return NextResponse.json({error: "You are not authorized for this action."}, {status: STATUS.Forbidden});
      }
      players = await getAllPlayers();
    }

    return NextResponse.json(players, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json({error: "Failed to fetch players."}, {status: STATUS.ServerError});
  }
}
