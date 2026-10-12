import {errorResponse} from "@/app/_lib/apiErrors";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {listMyPosts} from "@/app/_lib/service/burza/burza";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";

export const dynamic = "force-dynamic";

// Moji oglasi: the logged-in player's own ads, with their status ({active, past})
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;

  try {
    return NextResponse.json(await listMyPosts(auth.user), {status: STATUS.OK});
  } catch (error) {
    return errorResponse(error, "Oglasi se nisu učitali.");
  }
}
