// src/app/api/players/[id]/route.ts
import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {getPlayerById} from "@/app/_lib/service/players/getById";
import {isAdmin, requireUser} from "@/app/_lib/service/auth/requireUser";
import {
  PHOTO_BLOCK_ADMIN_ONLY,
  PHOTO_VISIBILITY_SELF_ONLY,
  PLAYER_NOT_FOUND,
  PlayerProfileUpdate,
  PlayerPublicResponseValidation,
} from "@/app/_interfaces/player";
import {prisma} from "@/app/_lib/prisma";
import {errorResponse} from "@/app/_lib/apiErrors";
import {USERNAME_TAKEN} from "@/app/_lib/validation/username";
import {anyCase} from "@/app/_lib/helpers/query/anyCase";
import {fullAccess} from "@/app/_lib/players/privacy";
import {ownPhoto} from "@/app/_lib/service/players/photos";
import {Prisma} from "@prisma/client";

// One player. The player themselves and admins get every field; anyone else only the name and whether the account is
// active (handoff §6 "Privacy"). A deleted player doesn't exist any more (404).
export async function GET(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);

  try {
    const player = await getPlayerById(id);

    if (!player) {
      return NextResponse.json({error: PLAYER_NOT_FOUND}, {status: STATUS.NotFound});
    }

    if (!fullAccess(auth.user, id)) return NextResponse.json(PlayerPublicResponseValidation.parse(player), {status: STATUS.OK});
    // the photo's settings (and, for the player, whether Google offers a picture): Moj profil and the admin's controls
    return NextResponse.json({...player, ...(await ownPhoto(id, auth.user))}, {status: STATUS.OK});
  } catch (error) {
    console.log(error);
    return NextResponse.json({error: "Igrač se nije učitao."}, {status: STATUS.ServerError});
  }
}

// A player changes their own birth date (asked after a Google sign-up), username, phone number, whether they smoke
// and/or who sees their photo. Admins may change anyone's, apart from the photo's visibility, and alone switch
// "Zabrani novu sliku" (photo_blocked). A taken username (ignoring case) is a 409 with {error, errors: {username}}.
export async function PATCH(request: NextRequest, {params}: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (auth.user.id !== id && !isAdmin(auth.user)) {
    return NextResponse.json({error: "Možeš mijenjati samo svoj profil."}, {status: STATUS.Forbidden});
  }

  try {
    const {birth_date, username, phone, smoker, photo_visibility, photo_blocked} = PlayerProfileUpdate.parse(await request.json());
    if (photo_visibility !== undefined && auth.user.id !== id) {
      return NextResponse.json({error: PHOTO_VISIBILITY_SELF_ONLY}, {status: STATUS.Forbidden});
    }
    if (photo_blocked !== undefined && !isAdmin(auth.user)) {
      return NextResponse.json({error: PHOTO_BLOCK_ADMIN_ONLY}, {status: STATUS.Forbidden});
    }
    if (username !== undefined) {
      const taken = await prisma.player.findFirst({
        where: {username: anyCase(username), id: {not: id}},
        select: {id: true},
      });
      if (taken) return usernameTakenResponse();
    }

    const {count} = await prisma.player.updateMany({
      // a deleted player's anonymised row is not edited
      where: {id, deleted_at: null},
      data: {
        ...(birth_date !== undefined && {birth_date: new Date(birth_date)}),
        ...(username !== undefined && {username}),
        ...(phone !== undefined && {phone}),
        // answered, so the app doesn't ask again
        ...(smoker !== undefined && {smoker, smoker_answered: true}),
        ...(photo_visibility !== undefined && {photo_visibility}),
        ...(photo_blocked !== undefined && {photo_blocked}),
      },
    });
    if (count === 0) {
      return NextResponse.json({error: PLAYER_NOT_FOUND}, {status: STATUS.NotFound});
    }
    return NextResponse.json({birth_date, username, phone, smoker, photo_visibility, photo_blocked}, {status: STATUS.OK});
  } catch (error) {
    // two players taking the same username at once: the unique index catches the second
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return usernameTakenResponse();
    return errorResponse(error, "Promjena nije spremljena.");
  }
}

function usernameTakenResponse(): NextResponse {
  return NextResponse.json({error: USERNAME_TAKEN, errors: {username: USERNAME_TAKEN}}, {status: STATUS.Conflict});
}
