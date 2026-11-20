import {isPublicBurzaPath, isPublicTournamentPath} from "@/app/_lib/publicPaths";
import {verifyCookie} from "@/app/_lib/service/auth/signCookie";

// The middleware's page gate, kept apart from middleware.ts so it can be tested without Next's request objects

// Paths the middleware lets through without a login: the API (each route checks the login itself with requireUser),
// Prijava and Registracija, the season table of any league, Burza igrača's ads, the tournaments, Next's own files, the
// app manifest and icons (read by the browser before anyone logs in) and images
export function isOpenPath(path: string): boolean {
  return (
    path.startsWith("/api") ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    /^\/league\/(\d+|current)\/standings\/?$/.test(path) ||
    isPublicBurzaPath(path) ||
    isPublicTournamentPath(path) ||
    path.startsWith("/_next/") ||
    path === "/manifest.webmanifest" ||
    path.startsWith("/static/") ||
    /\.(png|jpg|jpeg|gif|svg|webp)$/.test(path)
  );
}

// A Google login's session token as NextAuth makes it (a UUID). The middleware can't look it up (no database on the
// edge), so it only checks the shape; an empty or junk value doesn't open a page.
export function isPlausibleGoogleToken(value: string | undefined): boolean {
  return !!value && /^[\w-]{20,256}$/.test(value);
}

// An optimistic check only: the middleware runs on the edge runtime without the database, so it can't tell whether
// the session behind a cookie still exists. The real check is in every API route (requireUser), and /api/auth/me
// removes dead cookies and sends the browser to /login.
export async function hasLoginCookie(cookies: {password?: string; google?: string}): Promise<boolean> {
  if (cookies.password && (await verifyCookie({value: cookies.password}))) return true;
  return isPlausibleGoogleToken(cookies.google);
}

// The login page; someone opening a Burza form comes back to it after logging in
export function loginUrl(requestUrl: string): URL {
  const requested = new URL(requestUrl);
  const url = new URL("/login", requested);
  if (requested.pathname.startsWith("/burza")) url.searchParams.set("next", requested.pathname + requested.search);
  return url;
}
