import {BurzaRepostRequest, BurzaRepostRequestValidation} from "@/app/_interfaces/burza";
import {errorResponse} from "@/app/_lib/apiErrors";
import {REPOST_FORBIDDEN} from "@/app/_lib/burzaStatus";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {repostPost} from "@/app/_lib/service/burza/burza";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// the largest Postgres integer
const MAX_ID = 2_147_483_647;

// Moji oglasi · Objavi ponovno: its author puts a closed or expired ad up again ({night} gives a substitute ad a new
// night). Answers with the ad that is up, which is another one when the same ad is already open.
export async function POST(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    // the body is optional
    const body = BurzaRepostRequestValidation.parse(await request.json().catch(() => ({}))) as BurzaRepostRequest;
    const id = Number(params.id);
    // an id the database can't hold doesn't exist either
    if (!Number.isInteger(id) || id < 1 || id > MAX_ID) return NextResponse.json({error: "Oglas ne postoji."}, {status: STATUS.NotFound});
    const post = await repostPost(auth.user, id, body.night);
    if (post === "forbidden") return NextResponse.json({error: REPOST_FORBIDDEN}, {status: STATUS.Forbidden});
    return NextResponse.json(post, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Oglas nije ponovno objavljen.");
  }
}
