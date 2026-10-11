import {Player} from "@prisma/client";
import {NextRequest, NextResponse} from "next/server";
import {prisma} from "../../prisma";
import {lucia} from "../../luciaAuth";
import {googleSessionCookieOptions, SESSION_MAX_AGE_SECONDS} from "../../sessionConfig";
import {extractCookieWithoutSignature, signCookie} from "./signCookie";

export type ResolvedSession =
  | {user: Player; kind: "google"; token: string}
  | {user: Player; kind: "password"; sessionId: string};

// The session behind the request's cookies, or null. Database errors are thrown, so a caller can tell
// "not logged in" from "could not check".
export async function resolveSession(req: NextRequest): Promise<ResolvedSession | null> {
  const googleToken = req.cookies.get(process.env.GOOGLE_AUTH_COOKIE)?.value;
  if (googleToken) {
    const session = await prisma.session.findUnique({
      where: {sessionToken: googleToken, expires: {gt: new Date()}},
      include: {user: true},
    });
    // an expired Google session doesn't end a valid password login, so fall through to the Lucia cookie
    if (session?.user) return {user: session.user, kind: "google", token: googleToken};
  }

  const signedCookie = req.cookies.get(process.env.AUTH_COOKIE);
  if (signedCookie?.value) {
    let sessionId: string | undefined;
    try {
      sessionId = extractCookieWithoutSignature(signedCookie)?.value;
    } catch {
      return null; // malformed cookie
    }
    if (sessionId) {
      const result = await lucia.validateSession(sessionId);
      if (result.user) {
        const user = await prisma.player.findUnique({where: {id: result.user.id}});
        if (user) return {user, kind: "password", sessionId};
      }
    }
  }

  return null;
}

// Pushes the session's expiry out to the full length again and re-issues its cookie with the same expiry
export async function extendSession(session: ResolvedSession, res: NextResponse): Promise<void> {
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  if (session.kind === "google") {
    await prisma.session.update({where: {sessionToken: session.token}, data: {expires}});
    res.cookies.set(process.env.GOOGLE_AUTH_COOKIE, session.token, {...googleSessionCookieOptions, expires});
  } else {
    await prisma.luciaSession.update({where: {id: session.sessionId}, data: {expiresAt: expires}});
    const cookie = lucia.createSessionCookie(session.sessionId);
    signCookie(cookie);
    res.cookies.set(cookie.name, cookie.value, cookie.attributes);
  }
}

// Removes session cookies that no longer belong to a session. The middleware only checks that a cookie is there
// and signed (it can't reach the database), so a dead cookie would otherwise keep opening protected pages.
export function clearSessionCookies(req: NextRequest, res: NextResponse): void {
  if (req.cookies.get(process.env.AUTH_COOKIE)?.value) {
    const blank = lucia.createBlankSessionCookie();
    res.cookies.set(blank.name, blank.value, blank.attributes);
  }
  if (req.cookies.get(process.env.GOOGLE_AUTH_COOKIE)?.value) {
    res.cookies.delete(process.env.GOOGLE_AUTH_COOKIE);
  }
}
