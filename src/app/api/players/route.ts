// src/app/api/players/route.ts

import {NextRequest, NextResponse} from "next/server";
import {getAuthorizedUser} from "@/app/_lib/auth";
import {STATUS} from "@/app/_lib/statusCodes";
import {getAllPlayers} from "@/app/_lib/service/players/getAll";
import {searchPlayers} from "@/app/_lib/service/players/search";

export async function GET(req: NextRequest) {
  const {searchParams} = new URL(req.url);
  const query = searchParams.get("query");

  const user = await getAuthorizedUser(req);
  if (!user) {
    return NextResponse.json({message: "You are not authorized for this action."}, {status: STATUS.NotAllowed});
  }

  try {
    let players;

    if (query) {
      players = await searchPlayers(query)
    } else {
      players = await getAllPlayers();
    }

    return NextResponse.json(players, {status: STATUS.OK});
  } catch (error) {
    return NextResponse.json({error: "Failed to fetch players."}, {status: STATUS.ServerError});
  }
}
