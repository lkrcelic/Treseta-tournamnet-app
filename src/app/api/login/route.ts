import {prisma} from "@/app/_lib/prisma";
import {NextRequest, NextResponse} from "next/server";
import {randomUUID} from "crypto";

import argon2 from "argon2";
import {LoginUser} from "@/app/_interfaces/login";
import {STATUS} from "@/app/_lib/statusCodes";
import {extractCookieWithoutSignature, signCookie} from "@/app/_lib/service/auth/signCookie";
import { lucia } from "@/app/_lib/luciaAuth";
import {clearFailedLogins, isLoginLocked, loginLimitKey, recordFailedLogin} from "@/app/_lib/rateLimiting/loginLimiting";

// A new response each time: a response body can only be sent once
const notFoundResponse = () => NextResponse.json({error: "Incorrect username or password."}, {status: STATUS.NotFound});

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
          OR: [
            {username: {equals: login, mode: "insensitive"}},
            {email: {equals: login, mode: "insensitive"}},
          ],
        },
        orderBy: {id: "asc"},
      });

    // The limit is per account (username and email count together). The attempt is counted before the password is
    // checked, so parallel requests can't all get through; a correct password clears the count again.
    const limitKey = loginLimitKey(req, existingUser ? `player:${existingUser.id}` : `login:${login.toLowerCase()}`);
    if (isLoginLocked(limitKey)) {
      return NextResponse.json({error: "Too many login attempts. Try again later."}, {status: STATUS.TooManyRequests});
    }
    recordFailedLogin(limitKey);

    // Google accounts have no password
    if (!existingUser || !existingUser.password_hash) {
      return notFoundResponse();
    }
    const validPassword = await argon2.verify(existingUser.password_hash, user.password);
    if (!validPassword) {
      return notFoundResponse();
    }
    clearFailedLogins(limitKey);

    /*
      It is neccessary to provide sessionId because lucia implements a different kind of id generator
      which is not conformant with postgresql for some reason.
    */
    const session = await lucia.createSession(existingUser.id, {}, {sessionId: randomUUID()});
    const cookie = lucia.createSessionCookie(session.id);
    signCookie(cookie);

    const response = NextResponse.json({message: "Login successful."}, {status: STATUS.OK});
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
    console.error("Error: ", error);
    return NextResponse.json({message: "Login unsuccessful."}, {status: STATUS.ServerError});
  }
}
