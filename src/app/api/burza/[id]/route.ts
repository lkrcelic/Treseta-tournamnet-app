import {BurzaUpdateRequestValidation} from "@/app/_interfaces/burza";
import {errorResponse} from "@/app/_lib/apiErrors";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {getAuthorizedUser} from "@/app/_lib/service/auth/getAuthorizedUser";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {closePost, getPostView} from "@/app/_lib/service/burza/burza";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// A new response each time: a response body can only be sent once
const notFoundResponse = () => NextResponse.json({error: "Oglas ne postoji."}, {status: STATUS.NotFound});

// One ad, for its page and shared links. Public; a closed ad comes without its phone number.
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  try {
    const id = Number(params.id);
    // an id the database can't hold (also a malformed link) doesn't exist either
    if (!isDbId(id)) return notFoundResponse();
    const post = await getPostView(id, await getAuthorizedUser(request));
    if (!post) return notFoundResponse();
    return NextResponse.json(post, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Oglas se nije učitao.");
  }
}

// Close an ad ({closed: true}): its author or an admin
export async function PATCH(request: NextRequest, {params}: {params: {id: string}}) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    BurzaUpdateRequestValidation.parse(await request.json());
    const id = Number(params.id);
    if (!isDbId(id)) return notFoundResponse();
    const post = await closePost(auth.user, id);
    if (post === "forbidden") return NextResponse.json({error: "Možeš zatvoriti samo svoj oglas."}, {status: STATUS.Forbidden});
    return NextResponse.json(post, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Oglas nije zatvoren.");
  }
}
