import {NextRequest, NextResponse} from "next/server";
import {STATUS} from "@/app/_lib/statusCodes";

// A profile photo as the photo routes send it. Its address carries the version (?v=, when it last changed), so the
// browser keeps it for good while that is the current one; an old or missing version is kept only a minute. Private:
// who may see a photo depends on who asks.
export function photoResponse(request: NextRequest, photo: {photo: Buffer; type: string; updatedAt: Date}): NextResponse {
  const current = request.nextUrl.searchParams.get("v") === String(photo.updatedAt.getTime());
  return new NextResponse(new Uint8Array(photo.photo), {
    status: STATUS.OK,
    headers: {
      "Content-Type": photo.type,
      "Content-Length": String(photo.photo.length),
      "Cache-Control": current ? "private, max-age=31536000, immutable" : "private, max-age=60",
      // only ever an image, never run as anything else
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

// No photo, or one the viewer may not see: the same answer, so it says nothing about which
export const noPhoto = () => new NextResponse(null, {status: STATUS.NotFound, headers: {"Cache-Control": "private, no-store"}});
