import {getAuthorizedUser, lucia} from "@/app/_lib/auth";
import {prisma} from "@/app/_lib/prisma";
import {NextRequest, NextResponse} from "next/server";
import {randomUUID} from "crypto";

import argon2 from "argon2";
import {LoginUser} from "@/app/_interfaces/login";
import {STATUS} from "@/app/_lib/statusCodes";
import {signCookie} from "@/app/_lib/signCookie";

const notFoundResponse = NextResponse.json({error: "Incorrect username or password."}, {status: STATUS.NotFound});
const alreadyLoggedIn = NextResponse.json({error: "You are already logged it."}, {status: STATUS.BadRequest});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = LoginUser.parse(body);

    const currentUser = await getAuthorizedUser(req);
    // TODO?: Check if the user is already logged in, decide what to do
    // Disallow log in?, Logout from other device and log in on this one?, Both logged in?
    // TODO: Implement rate limiting per login credential.
    if (currentUser) {
      return alreadyLoggedIn;
    }
    const existingUser = await prisma.player.findFirst({where: {OR: [{username: user.username}, {email: user.username}]}});
    if (!existingUser) {
      return notFoundResponse;
    }
    const validPassword = await argon2.verify(existingUser.password_hash, user.password);
    if (!validPassword) {
      return notFoundResponse;
    }

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
    return response;
  } catch (error) {
    console.error("Error: ", error);
    return NextResponse.json({message: "Login unsuccessful."}, {status: STATUS.ServerError});
  }
}
