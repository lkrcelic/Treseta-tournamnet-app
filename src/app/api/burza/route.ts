import {BurzaCreate, BurzaCreateRequestValidation} from "@/app/_interfaces/burza";
import {errorResponse} from "@/app/_lib/apiErrors";
import {getAuthorizedUser} from "@/app/_lib/service/auth/getAuthorizedUser";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {createPost, listOpenPosts} from "@/app/_lib/service/burza/burza";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

// never cached: ads come and go
export const dynamic = "force-dynamic";

// The open ads of Burza igrača. Public; a logged-in viewer also learns which ads are theirs and on which nights
// they play themselves.
export async function GET(request: NextRequest) {
  try {
    const viewer = await getAuthorizedUser(request);
    return NextResponse.json({posts: await listOpenPosts(viewer)}, {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Oglasi se nisu učitali.");
  }
}

// Publish an ad
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    const body = BurzaCreateRequestValidation.parse(await request.json()) as BurzaCreate;
    return NextResponse.json(await createPost(auth.user, body), {status: STATUS.Created});
  } catch (error) {
    return errorResponse(error, "Oglas nije objavljen.");
  }
}
