// src/app/api/players/[id]/route.ts
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getPlayerById} from "@/app/_lib/service/players/getById";
import {isAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {PlayerPartialResponseValidation, PlayerProfileUpdate} from "@/app/_interfaces/player";
import {prisma} from "@/app/_lib/prisma";
import {errorResponse} from "@/app/_lib/apiErrors";
import {USERNAME_TAKEN} from "@/app/_lib/validation/username";
import {Prisma} from "@prisma/client";

// Handle GET request to fetch a single player by ID.
// Email and role are only shown to the player themselves and to admins.
export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);

  try {
    const player = await getPlayerById(id);

    if (!player) {
      return NextResponse.json({error: "Player not found."}, {status: STATUS.NotFound});
    }

    const canSeeDetails = auth.user.id === id || isAdmin(auth.user);
    return NextResponse.json(canSeeDetails ? player : PlayerPartialResponseValidation.parse(player), {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Failed to fetch player."}, {status: STATUS.ServerError});
  }
}

// A player changes their own birth date (asked after a Google sign-up) and/or username. Admins may change anyone's.
// A taken username (ignoring case) is a 409 with {error, errors: {username}}.
export async function PATCH(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (auth.user.id !== id && !isAdmin(auth.user)) {
    return NextResponse.json({error: "You can only change your own profile."}, {status: STATUS.Forbidden});
  }

  try {
    const {birth_date, username} = PlayerProfileUpdate.parse(await request.json());
    if (username !== undefined) {
      const taken = await prisma.player.findFirst({
        where: {username: {equals: username, mode: "insensitive"}, id: {not: id}},
        select: {id: true},
      });
      if (taken) return usernameTakenResponse();
    }

    const {count} = await prisma.player.updateMany({
      where: {id},
      data: {
        ...(birth_date !== undefined && {birth_date: new Date(birth_date)}),
        ...(username !== undefined && {username}),
      },
    });
    if (count === 0) {
      return NextResponse.json({error: "Player not found."}, {status: STATUS.NotFound});
    }
    return NextResponse.json({birth_date, username}, {status: STATUS.OK});
  } catch (error) {
    // two players taking the same username at once: the unique index catches the second
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return usernameTakenResponse();
    return errorResponse(error, "Failed to update player.");
  }
}

function usernameTakenResponse(): NextResponse {
  return NextResponse.json({error: USERNAME_TAKEN, errors: {username: USERNAME_TAKEN}}, {status: STATUS.Conflict});
}
