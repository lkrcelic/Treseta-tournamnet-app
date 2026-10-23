import {prisma} from "@/app/_lib/prisma";
import {NextRequest, NextResponse} from "next/server";
import {randomUUID} from "crypto";
import {z} from "zod";

import {LoginUser} from "@/app/_interfaces/login";
import {STATUS} from "@/app/_lib/statusCodes";
import {extractCookieWithoutSignature, signCookie} from "@/app/_lib/service/auth/signCookie";
import { lucia } from "@/app/_lib/luciaAuth";
import {clearFailedLogins, isLoginLocked, loginLimitKey, recordFailedLogin} from "@/app/_lib/rateLimiting/loginLimiting";
import {clearAccountLogins, countAccountLogin} from "@/app/_lib/rateLimiting/accountLimiting";
import {verifyPassword} from "@/app/_lib/service/auth/verifyPassword";
import {anyCase} from "@/app/_lib/helpers/query/anyCase";
import {ACCOUNT_DEACTIVATED} from "@/app/_interfaces/login";

// A new response each time: a response body can only be sent once
const notFoundResponse = () => NextResponse.json({error: "Pogrešno korisničko ime ili lozinka."}, {status: STATUS.NotFound});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = LoginUser.parse(body);

    // Logging in while a session cookie is still there (e.g. someone else used this phone) replaces that session
    // An exact match first, then ignoring case (phone keyboards capitalize the first letter)
    const login = user.username.trim();
    const existingUser =
      await prisma.player.findFirst({where: {OR: [{username: login}, {email: login}]}}) ??
      await prisma.player.findFirst({
        where: {
          OR: [{username: anyCase(login)}, {email: anyCase(login)}],
        },
        orderBy: {id: "asc"},
      });

    // The limit is per account (username and email count together). The attempt is counted before the password is
    // checked, so parallel requests can't all get through; a correct password clears the count again.
    // Two limits: per address and account (in memory), and per account from any address (in the database, so it holds
    // across addresses and instances). A missing account is counted the same way, so a lockout doesn't tell it apart.
    const accountKey = existingUser ? `player:${existingUser.id}` : `login:${login.toLowerCase()}`;
    const limitKey = loginLimitKey(req, accountKey);
    if (isLoginLocked(limitKey) || await countAccountLogin(prisma, accountKey)) {
      return NextResponse.json({error: "Previše pokušaja prijave. Pokušaj kasnije."}, {status: STATUS.TooManyRequests});
    }
    recordFailedLogin(limitKey);

    // Google accounts have no password; both still run a hash check, so the timing doesn't tell they're different
    const validPassword = await verifyPassword(existingUser?.password_hash, user.password);
    if (!existingUser || !validPassword) {
      return notFoundResponse();
    }
    clearFailedLogins(limitKey);
    await clearAccountLogins(prisma, accountKey);
    // deactivated by an admin (a deleted player has no password, so they never get this far)
    if (!existingUser.active) {
      return NextResponse.json({error: ACCOUNT_DEACTIVATED}, {status: STATUS.Forbidden});
    }

    /*
      It is neccessary to provide sessionId because lucia implements a different kind of id generator
      which is not conformant with postgresql for some reason.
    */
    const session = await lucia.createSession(existingUser.id, {}, {sessionId: randomUUID()});
    const cookie = lucia.createSessionCookie(session.id);
    signCookie(cookie);

    const response = NextResponse.json({message: "Prijava je uspjela."}, {status: STATUS.OK});
    response.cookies.set(cookie.name, cookie.value, {
      ...cookie.attributes,
    });

    // A leftover Google session would take precedence over the new login, so end it
    const googleCookie = req.cookies.get(process.env.GOOGLE_AUTH_COOKIE);
    if (googleCookie?.value) {
      await prisma.session.deleteMany({where: {sessionToken: googleCookie.value}});
      response.cookies.delete(process.env.GOOGLE_AUTH_COOKIE);
    }
    const previousLuciaCookie = req.cookies.get(process.env.AUTH_COOKIE);
    if (previousLuciaCookie?.value) {
      try {
        const previous = extractCookieWithoutSignature(previousLuciaCookie);
        if (previous?.value) await lucia.invalidateSession(previous.value);
      } catch {
        // malformed old cookie, it gets overwritten anyway
      }
    }
    return response;
  } catch (error) {
    // an empty username or password (Prijava checks both fields before sending), or a body that isn't JSON
    if (error instanceof z.ZodError) {
      return NextResponse.json({error: "Upiši korisničko ime i lozinku."}, {status: STATUS.BadRequest});
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({error: "Neispravan zahtjev."}, {status: STATUS.BadRequest});
    }
    console.error("Error: ", error);
    return NextResponse.json({error: "Prijava nije uspjela."}, {status: STATUS.ServerError});
  }
}
