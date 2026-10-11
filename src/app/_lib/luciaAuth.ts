import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { Lucia, TimeSpan } from "lucia";
import { prisma } from "./prisma";
import { SESSION_MAX_AGE_SECONDS } from "./sessionConfig";

const adapter = new PrismaAdapter(prisma.luciaSession, prisma.player);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    name: process.env.AUTH_COOKIE,
    expires: true,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  sessionExpiresIn: new TimeSpan(SESSION_MAX_AGE_SECONDS, "s"),
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
