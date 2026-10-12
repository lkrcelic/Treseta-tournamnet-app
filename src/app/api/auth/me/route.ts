import {NextRequest, NextResponse} from "next/server";
import {clearSessionCookies, extendSession, findSession} from "@/app/_lib/service/auth/session";
import {isAdminRole} from "@/app/_lib/players/admin";
import {ACCOUNT_DEACTIVATED} from "@/app/_interfaces/login";
import {STATUS} from "@/app/_lib/statusCodes";

// Called by the app on every load, and whenever another request answers 401: who is logged in. It also keeps the login
// alive (sliding expiry) and removes cookies of sessions that no longer exist, so the middleware's cookie check sends
// those to the login page. 401 = nobody is logged in; 403 = the login belongs to a player an admin deactivated (the app
// then shows Prijava with "Račun je deaktiviran…").
export async function GET(req: NextRequest) {
  try {
    const session = await findSession(req);
    if (!session?.user.active) {
      const res = session
        ? NextResponse.json({user: null, error: ACCOUNT_DEACTIVATED}, {status: STATUS.Forbidden})
        : NextResponse.json({user: null}, {status: STATUS.Unauthorized});
      clearSessionCookies(req, res);
      return res;
    }

    // Return only minimal, safe fields
    const res = NextResponse.json({
      user: {
        id: session.user.id,
        username: session.user.username,
        // admin menus and controls show from the stored user right away (useIsAdmin); the server checks every call
        is_admin: isAdminRole(session.user),
        // Google sign-ups don't give a birth date; the app asks for it
        needs_birth_date: session.user.birth_date == null,
        // "Pušiš li?" wasn't answered (a Google sign-up, or a player from before the question); asked after the birth date
        needs_smoker: !session.user.smoker_answered,
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
