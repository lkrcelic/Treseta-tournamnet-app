import {isApiLimited} from "@/app/_lib/rateLimiting/requestLimiting";
import {verifyCookie} from "@/app/_lib/service/auth/signCookie";
import {STATUS} from "@/app/_lib/statusCodes";
import {Cookie} from "lucia";
import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";
export {auth} from "@/app/_lib/googleAuth";

export async function middleware(req: NextRequest) {
  if (
    !(
      req.nextUrl.pathname.startsWith("/api/auth") ||
      req.nextUrl.pathname.startsWith("/api") ||
      req.nextUrl.pathname.startsWith("/login") ||
      req.nextUrl.pathname.startsWith("/signup") ||
      // the season table of any league is public; everything else needs a login
      /^\/league\/(\d+|current)\/standings\/?$/.test(req.nextUrl.pathname) ||
      req.nextUrl.pathname.startsWith("/_next/") ||
      // the app manifest and icons, read by the browser before anyone logs in
      req.nextUrl.pathname === "/manifest.webmanifest" ||
      req.nextUrl.pathname.startsWith("/static/") ||
      req.nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg)$/)
    )
  ) {
    const authorized = await authenticationMiddleware(req);
    if (!authorized) return NextResponse.redirect(new URL("/login", req.url));
  }

  // failed logins are limited in /api/login itself, which knows whether the password was right

  if (req.nextUrl.pathname.startsWith("/api")) {
    if (await isApiLimited(req)) {
      return NextResponse.json({error: "Too many requests. Slow down!"}, {status: STATUS.TooManyRequests});
    }
  }

  return NextResponse.next();
}

// An optimistic check only: the middleware runs on the edge runtime without the database, so it can't tell whether
// the session behind a signed cookie still exists. The real check is in every API route (requireUser), and
// /api/auth/me removes dead cookies and sends the browser to /login.
async function authenticationMiddleware(req: NextRequest) {
  const reqCookie = req.cookies.get(process.env.AUTH_COOKIE);
  if (reqCookie) {
    const cookie = await verifyCookie(reqCookie as Cookie);
    if (cookie) return true;
  }

  const nextAuthCookie = req.cookies.get(process.env.GOOGLE_AUTH_COOKIE);
  if (nextAuthCookie) {
    return true;
  }

  return false;
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
