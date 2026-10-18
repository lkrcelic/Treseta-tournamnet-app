import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";
import {requireUser} from "@/app/_lib/service/auth/requireUser";
import {fetchGooglePhoto} from "@/app/_lib/service/players/photos";

export const dynamic = "force-dynamic";

// The logged-in player's Google picture (Player.image from the Google sign-in), passed through so the cropper can draw
// it on a canvas; only offered, never set by itself. 404 when there is none or Google doesn't give it.
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.response) return auth.response;
  const google = await fetchGooglePhoto(auth.user.image ?? "");
  if (!google) return new NextResponse(null, {status: STATUS.NotFound});
  return new NextResponse(new Uint8Array(google.bytes), {
    status: STATUS.OK,
    headers: {
      "Content-Type": google.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
