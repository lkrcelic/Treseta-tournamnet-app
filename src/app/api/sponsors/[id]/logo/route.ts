import {NextRequest, NextResponse} from "next/server";
import {isDbId} from "@/app/_lib/helpers/query/dbId";
import {getSponsorLogo} from "@/app/_lib/service/sponsors/sponsors";
import {STATUS} from "@/app/_lib/statusCodes";

export const dynamic = "force-dynamic";

// A sponsor's logo (public). Its address carries the version (?v=), so the browser may keep it for good; an address
// without the current version is kept only briefly.
export async function GET(request: NextRequest, {params}: {params: {id: string}}) {
  const id = Number(params.id);
  if (!isDbId(id)) return new NextResponse(null, {status: STATUS.NotFound});
  try {
    const logo = await getSponsorLogo(id);
    if (!logo) return new NextResponse(null, {status: STATUS.NotFound});
    const current = request.nextUrl.searchParams.get("v") === String(logo.updatedAt.getTime());
    return new NextResponse(new Uint8Array(logo.logo), {
      status: STATUS.OK,
      headers: {
        "Content-Type": logo.type,
        "Content-Length": String(logo.logo.length),
        "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=60",
        // only ever an image, never run as anything else
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(null, {status: STATUS.ServerError});
  }
}
