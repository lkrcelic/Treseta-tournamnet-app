import {BurzaUpdateRequestValidation} from "@/app/_interfaces/burza";
import {errorResponse} from "@/app/_lib/apiErrors";
import {getAuthorizedUser} from "@/app/_lib/service/auth/getAuthorizedUser";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {closePost, getPostView} from "@/app/_lib/service/burza/burza";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// One ad, for its page and shared links. Public; a closed ad comes without its phone number.
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  try {
    const post = await getPostView(Number(params.id), await getAuthorizedUser(request));
    if (!post) return NextResponse.json({error: "Oglas ne postoji."}, {status: STATUS.NotFound});
    return NextResponse.json(post, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Failed to fetch the ad.");
  }
}

// Close an ad ({closed: true}): its author or an admin
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    BurzaUpdateRequestValidation.parse(await request.json());
    const post = await closePost(auth.user, Number(params.id));
    if (post === "forbidden") return NextResponse.json({error: "Možeš zatvoriti samo svoj oglas."}, {status: STATUS.Forbidden});
    return NextResponse.json(post, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Oglas nije zatvoren.");
  }
}
