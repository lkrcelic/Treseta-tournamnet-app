import {Player, RoleEnum} from "@prisma/client";
import {NextRequest, NextResponse} from "next/server";
import {prisma} from "@/app/_lib/prisma";
import {STATUS} from "@/app/_lib/statusCodes";
import {getAuthorizedUser} from "./getAuthorizedUser";

// The middleware lets every /api request through, so each route checks the session itself with these helpers:
//   const auth = await requireUser(request);
//   if (auth.response) return auth.response;
export type AuthResult = {user: Player; response?: undefined} | {user?: undefined; response: NextResponse};

export async function requireUser(req: NextRequest): Promise<AuthResult> {
  const user = await getAuthorizedUser(req);
  if (!user) {
    return {response: NextResponse.json({error: "You need to log in."}, {status: STATUS.Unauthorized})};
  }
  return {user};
}

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const auth = await requireUser(req);
  if (auth.response) return auth;
  if (!isAdmin(auth.user)) {
    return {response: NextResponse.json({error: "You are not authorized for this action."}, {status: STATUS.Forbidden})};
  }
  return auth;
}

export function isAdmin(user: Player): boolean {
  return user.player_role === RoleEnum.ADMIN;
}

// Only the players of the two teams in a round (or an admin) may enter or change its results.
export async function canPlayRound(user: Player, roundId: number | null | undefined): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (roundId == null) return false;

  const round = await prisma.round.findFirst({
    where: {
      id: roundId,
      OR: [
        {team1: {teamPlayers: {some: {player_id: user.id}}}},
        {team2: {teamPlayers: {some: {player_id: user.id}}}},
      ],
    },
    select: {id: true},
  });
  return round !== null;
}

export function notYourRoundResponse(): NextResponse {
  return NextResponse.json({error: "You are not playing in this round."}, {status: STATUS.Forbidden});
}
