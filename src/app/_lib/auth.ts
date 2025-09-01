import {Lucia, TimeSpan} from "lucia";
import {PrismaAdapter} from "@lucia-auth/adapter-prisma";
import {prisma} from "./prisma";
import {Player, RoleEnum} from "@prisma/client";
import {NextRequest, NextResponse} from "next/server";
import {extractCookieWithoutSignature} from "./signCookie";

const adapter = new PrismaAdapter(prisma.luciaSession, prisma.player);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    name: process.env.AUTH_COOKIE,
    expires: true,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  sessionExpiresIn: new TimeSpan(4, "h"),
  getUserAttributes: (attributes) => {
    return {
      // attributes has the type of DatabaseUserAttributes
      username: attributes.username,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    UserId: number;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  username: string;
}

export async function getAuthorizedUser(req: NextRequest): Promise<Player | null> {

  // Try NextAuth authentication first
  const nextAuthCookie = req.cookies.get(process.env.GOOGLE_AUTH_COOKIE);
  if (nextAuthCookie && nextAuthCookie.value && nextAuthCookie.value !== "") {
    try {
      const session = await prisma.session.findUnique({
        where: {
          sessionToken: nextAuthCookie.value,
          expires: {
            gt: new Date(), // Only valid sessions
          }
        },
        include: {
          user: true,
        },
      });

      if (!session?.user) {
        return null;
      }

      return prisma.player.findUnique({
        where: {id: session.userId},
      });
    } catch (error) {
      console.error("Error validating NextAuth session:", error);
      return null;
    }
  }

  // If NextAuth auth fails, try Lucia
  const signedCookie = req.cookies.get(process.env.AUTH_COOKIE);
  if (signedCookie && signedCookie.value && signedCookie.value !== "") {
    const cookie = extractCookieWithoutSignature(signedCookie);
    if (cookie) {
      try {
        const result = await lucia.validateSession(cookie.value);
        console.log("Result: ", result);
        if (result.user) {
          return prisma.player.findUnique({
            where: {id: result.user.id},
          });
        }
      } catch (error) {
        console.error("Error validating session:", error);
      }
    }
  }

  return null;
}

export async function checkCurrentUserIsAdmin(req: NextRequest): Promise<boolean> {
  const user = await getAuthorizedUser(req);
  return user?.player_role === RoleEnum.ADMIN;
}

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
