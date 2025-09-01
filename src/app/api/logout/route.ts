import {lucia} from "@/app/_lib/auth";
import {STATUS} from "@/app/_lib/statusCodes";
import {NextRequest, NextResponse} from "next/server";
import {prisma} from "@/app/_lib/prisma";
import {extractCookieWithoutSignature} from "@/app/_lib/signCookie";

export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.json({}, {status: STATUS.OK});

    // Handle Lucia session logout
    const luciaSignedCookie = req.cookies.get(process.env.AUTH_COOKIE);
    if (luciaSignedCookie?.value) {
      try {
        // We need to directly find and invalidate the session
        // since getAuthorizedUser doesn't return the session ID
        const cookie = extractCookieWithoutSignature(luciaSignedCookie);
        if (cookie?.value) {
          await lucia.invalidateSession(cookie.value);
        }
        res.cookies.set(lucia.createBlankSessionCookie());
      } catch (error) {
        console.error("Error invalidating Lucia session:", error);
      }
    }

    // Handle NextAuth session logout
    const nextAuthCookie = req.cookies.get(process.env.GOOGLE_AUTH_COOKIE);
    if (nextAuthCookie?.value) {
      try {
        // Find and delete the session from the database
        await prisma.session.deleteMany({
          where: {
            sessionToken: nextAuthCookie.value
          }
        });

        // Clear all NextAuth cookies
        res.cookies.delete(process.env.GOOGLE_AUTH_COOKIE);
        res.cookies.delete("authjs.csrf-token");
        res.cookies.delete("authjs.callback-url");
      } catch (error) {
        console.error("Error invalidating NextAuth session:", error);
      }
    }

    return res;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({error: "Could not signout user."}, {status: STATUS.ServerError});
  }
}
