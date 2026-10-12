import {NextRequest, NextResponse} from "next/server";
import {PLAYER_NOT_FOUND, PlayerActiveValidation} from "@/app/_interfaces/player";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {requireAdmin} from "@/app/_lib/service/auth/requireUser";
import {setPlayerActive} from "@/app/_lib/service/players/admin";
import {STATUS} from "@/app/_lib/statusCodes";

// "Deaktiviraj račun" / "Aktiviraj račun" (admin) {active}: applies at once, apart from Spremi. Deactivating logs the
// player out and closes their ads that are still up. Answers {id, active}; deactivating yourself is a 400; a missing
// or deleted player a 404.
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const id = Number(params.id);
  if (!isDbId(id)) return NextResponse.json({error: PLAYER_NOT_FOUND}, {status: STATUS.NotFound});

  try {
    const {active} = PlayerActiveValidation.parse(await request.json());
    return NextResponse.json(await setPlayerActive(auth.user, id, active), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Promjena nije spremljena.");
  }
}
