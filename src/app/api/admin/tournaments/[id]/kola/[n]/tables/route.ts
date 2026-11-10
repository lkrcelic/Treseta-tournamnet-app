import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {errorResponse} from "@/app/_lib/apiErrors";
import {requireCan} from "@/app/_lib/service/auth/requireUser";
import {KoloTableValidation} from "@/app/_interfaces/tournament";
import {addKoloTable} from "@/app/_lib/service/tournament/kola";
import {refuseUnlessMine, tournamentIdOf, tournamentNotFound} from "@/app/_lib/service/tournament/routes";

// Novi stol in a Kolo (admin); its teams don't play in that Kolo yet, or one of them is the bye
export async function POST(request: NextRequest, {params}: {params: {id: string; n: string}}) {
  const auth = await requireCan(request, "tournament.manage.own");
  if (auth.response) return auth.response;
  const id = tournamentIdOf(params.id);
  if (id == null) return tournamentNotFound();
  try {
    await refuseUnlessMine(id, auth.user);
    const t = KoloTableValidation.parse(await request.json());
    return NextResponse.json({id: await addKoloTable(id, Number(params.n), t.team1_id, t.team2_id)}, {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Stol nije dodan.");
  }
}
