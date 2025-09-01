import type {NextRequest} from "next/server";
import {NextResponse} from "next/server";
import {verifyCookie} from "@/app/_lib/signCookie";
import {handleLogin} from "@/app/_lib/rateLimiting/loginLimiting";
import {Cookie} from "lucia";
import {STATUS} from "@/app/_lib/statusCodes";
import {isApiLimited} from "@/app/_lib/rateLimiting/requestLimiting";

export async function middleware(req: NextRequest) {
  if (
    !(
      req.nextUrl.pathname.startsWith("/api") ||
      req.nextUrl.pathname.startsWith("/login") ||
      req.nextUrl.pathname.startsWith("/signup") ||
      req.nextUrl.pathname.startsWith("/league/1/standings") ||
      req.nextUrl.pathname.startsWith('/_next/') ||
      req.nextUrl.pathname.startsWith('/static/') ||
      req.nextUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg)$/)
    )
  ) {
    const authorized = await authenticationMiddleware(req);
    if (!authorized) return NextResponse.redirect(new URL("/login", req.url));
  }

  if (req.nextUrl.pathname.startsWith("/api/login")) {
    if (await handleLogin(req)) {
      return NextResponse.json({error: "Too many login attempts. Try again later."}, {status: STATUS.TooManyRequests});
    }
  }

  if (req.nextUrl.pathname.startsWith("/api")) {
    if (await isApiLimited(req)) {
      return NextResponse.json({error: "Too many requests. Slow down!"}, {status: STATUS.TooManyRequests});
    }
  }

  return NextResponse.next();
}

async function authenticationMiddleware(req: NextRequest) {
  const reqCookie = req.cookies.get(process.env.AUTH_COOKIE);
  if (reqCookie) {
    const cookie = await verifyCookie(reqCookie as Cookie);
    if (cookie) return true;
  }

  const nextAuthCookie = req.cookies.get(process.env.GOOGLE_AUTH_COOKIE);
  if (nextAuthCookie) return true;

  return false
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
