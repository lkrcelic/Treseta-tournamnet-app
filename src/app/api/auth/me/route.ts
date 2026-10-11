import {NextRequest, NextResponse} from "next/server";
import {clearSessionCookies, extendSession, resolveSession} from "@/app/_lib/service/auth/session";

// Called by the app on every load: who is logged in. It also keeps the login alive (sliding expiry) and removes
// cookies of sessions that no longer exist, so the middleware's cookie check sends those to the login page.
export async function GET(req: NextRequest) {
  try {
    const session = await resolveSession(req);
    if (!session) {
      const res = NextResponse.json({user: null}, {status: 401});
      clearSessionCookies(req, res);
      return res;
    }

    // Return only minimal, safe fields
    const res = NextResponse.json({
      user: {
        id: session.user.id,
        username: session.user.username,
        // Google sign-ups don't give a birth date; the app asks for it
        needs_birth_date: session.user.birth_date == null,
      },
    });
    await extendSession(session, res);
    return res;
  } catch (e) {
    // the database couldn't be asked, which says nothing about the session: keep the cookies
    console.error("/api/auth/me error", e);
    return NextResponse.json({user: null}, {status: 500});
  }
}
