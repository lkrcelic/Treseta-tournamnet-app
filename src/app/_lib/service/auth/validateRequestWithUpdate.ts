import { lucia } from "../../luciaAuth";
import { NextRequest, NextResponse } from "next/server";
import { extractCookieWithoutSignature } from "./signCookie";
import { prisma } from "../../prisma";
import { Session } from "lucia";

export async function validateRequestWithUpdate(
    req: NextRequest,
    res: NextResponse
  ): Promise<{ userId: number; session: Session } | null> {
    const signedCookie = req.cookies.get(process.env.AUTH_COOKIE);
    if (!signedCookie || !signedCookie.value || signedCookie.value === "") {
      return null;
    }
    const cookie = extractCookieWithoutSignature(signedCookie);
    if (!cookie) {
      return null;
    }
    const session = await prisma.session.findUnique({
      where: {id: cookie.value},
    });
    if (!session) {
      return null;
    }
    const result = await lucia.validateSession(session.id); 
    if (!result.user) {
      return null;
    }
    if (result.session && result.session.fresh) {
      res.cookies.set(lucia.createSessionCookie(result.session.id));
    }
    if (!result.session) {
      res.cookies.set(lucia.createBlankSessionCookie());
    }
    return {userId: result.user.id, session: result.session};
  }
  