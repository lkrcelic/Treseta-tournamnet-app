import {hasLoginCookie, isOpenPath, loginUrl} from "@/app/_lib/pageGate";
import {isApiLimited} from "@/app/_lib/rateLimiting/requestLimiting";
import {STATUS} from "@/app/_lib/statusCodes";
import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";
export {auth} from "@/app/_lib/googleAuth";

export async function middleware(req: NextRequest) {
  if (!isOpenPath(req.nextUrl.pathname)) {
    const authorized = await hasLoginCookie({
      password: req.cookies.get(process.env.AUTH_COOKIE)?.value,
      google: req.cookies.get(process.env.GOOGLE_AUTH_COOKIE)?.value,
    });
    if (!authorized) return NextResponse.redirect(loginUrl(req.url));
  }

  // failed logins are limited in /api/login itself, which knows whether the password was right

  if (req.nextUrl.pathname.startsWith("/api")) {
    if (await isApiLimited(req)) {
      return NextResponse.json({error: "Previše zahtjeva. Pričekaj malo pa pokušaj ponovno."}, {status: STATUS.TooManyRequests});
    }
  }

  return NextResponse.next();
}

// TODO: Implement rate limiting per IP address.
// TODO: Maybe include redirecting on API calls as well?

export const config = {
  matcher: [
    /*
     * Match all pages except for:
     * - Static files (/_next/ and /public)
     */
    "/((?!_next|static|favicon.ico).*)",
  ],
};
