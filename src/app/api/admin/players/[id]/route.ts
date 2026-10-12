import {NextRequest, NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {AdminPlayerUpdateValidation, EMAIL_TAKEN, PLAYER_NOT_FOUND} from "@/app/_interfaces/player";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {adminUpdatePlayer, anonymisePlayer, PlayerFieldConflict} from "@/app/_lib/service/players/admin";
import {STATUS} from "@/app/_lib/statusCodes";
import {USERNAME_TAKEN} from "@/app/_lib/validation/username";

// "Uredi osobne podatke" → Spremi (admin): any of the player's details and the Pušač and Admin switches, only the
// fields that changed. Answers with the player as an admin sees them (PlayerView). A username or email another player
// has is a 409 {error, errors: {username?, email?}}; taking the admin role from yourself or from the last admin is a
// 400; a missing or deleted player a 404.
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return notFoundResponse();

  try {
    const body = AdminPlayerUpdateValidation.parse(await request.json());
    const result = await adminUpdatePlayer(auth.user, id, body);
    if ("conflicts" in result) return conflictResponse(result.conflicts);
    return NextResponse.json(result, {status: STATUS.OK});
  } catch (error) {
    // two admins saving the same username or email at once: the unique index catches the second
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String(error.meta?.target ?? "");
      return conflictResponse(target.includes("email") ? ["email"] : ["username"]);
    }
    return errorResponse(error, "Promjena nije spremljena.");
  }
}

// "Obriši igrača" (admin): anonymises the player (anonymisePlayer). 204; deleting yourself is a 400; a missing or
// already deleted player a 404.
export async function DELETE(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return notFoundResponse();

  try {
    await anonymisePlayer(auth.user, id);
    return new NextResponse(null, {status: STATUS.NoContent});
  } catch (error) {
    return errorResponse(error, "Igrač nije obrisan.");
  }
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({error: PLAYER_NOT_FOUND}, {status: STATUS.NotFound});
}

function conflictResponse(fields: PlayerFieldConflict["conflicts"]): NextResponse {
  const message = {username: USERNAME_TAKEN, email: EMAIL_TAKEN};
  const errors = Object.fromEntries(fields.map((f) => [f, message[f]]));
  return NextResponse.json({error: message[fields[0]], errors}, {status: STATUS.Conflict});
}
