import NextAuth from "next-auth"
import {PrismaAdapter} from "@auth/prisma-adapter";
import {prisma} from "@/app/_lib/prisma";
import {Adapter} from "@auth/core/adapters";
import Google from "next-auth/providers/google";
import {googleSessionCookieOptions, SESSION_MAX_AGE_SECONDS} from "@/app/_lib/sessionConfig";
import {anyCase} from "@/app/_lib/helpers/query/anyCase";
import {ACCOUNT_DEACTIVATED_CODE, PASSWORD_ACCOUNT_CODE} from "@/app/_interfaces/login";
import {GoogleLinkDecision, googleLinkDecision} from "@/app/_lib/auth/googleLink";
import {extractCookieWithoutSignature} from "@/app/_lib/service/auth/signCookie";
import {cookies} from "next/headers";

// Usernames are unique, so "ivan" from ivan@gmail.com becomes "ivan2" when "ivan" is already taken
async function availableUsername(base: string): Promise<string> {
  const taken = new Set(
    (await prisma.player.findMany({
      where: {username: {startsWith: base}},
      select: {username: true},
    })).map((p) => p.username)
  );
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}${suffix}`)) suffix++;
  return `${base}${suffix}`;
}

function CustomPrismaAdapter() {
    const standardAdapter = PrismaAdapter(prisma);
  
    return {
      // Use standard adapter methods for most operations
      ...standardAdapter,
  
      // Override methods that need to work with Player model
      createUser: async (data) => {
        // Map NextAuth user data to our Player model
        const user = await prisma.player.create({
          data: {
            email: data.email,
            name: data.name,
            image: data.image,
            emailVerified: data.emailVerified,
            // Set required fields with default values
            username: await availableUsername(data.email.split('@')[0]), // Use part of email as username
            password_hash: "", // Empty password for OAuth users
            player_role: "PLAYER", // Default role - using an enum value from RoleEnum
            // "Ana Marija Horvat" -> first name "Ana", last name "Marija Horvat"
            first_name: data.name?.trim().split(/\s+/)[0] || "",
            last_name: data.name?.trim().split(/\s+/).slice(1).join(" ") || "",
            birth_date: null, // Google doesn't give it; the app asks after the first login
          },
        });
  
        // Convert numeric ID to string as expected by NextAuth
        return {
          ...user,
          id: String(user.id),
        };
      },
  
      getUser: async (id) => {
        const user = await prisma.player.findUnique({
          where: {id: parseInt(id, 10)},
        });
        if (!user) return null;
        return {...user, id: String(user.id)};
      },
  
      // Ignoring case: Google reports "marko@gmail.com" for a player who signed up as "Marko@Gmail.com"
      getUserByEmail: async (email) => {
        const user = await prisma.player.findFirst({
          where: {email: anyCase(email)},
          orderBy: {id: "asc"},
        });
        if (!user) return null;
        return {...user, id: String(user.id)};
      },
  
      getUserByAccount: async ({provider, providerAccountId}) => {
        const account = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider,
              providerAccountId,
            },
          },
          include: {user: true},
        });
        if (!account?.user) return null;
        return {...account.user, id: String(account.user.id)};
      },
  
      updateUser: async (data) => {
        // Extract id and convert to number for the where clause
        const {id, ...updateData} = data;
  
        const user = await prisma.player.update({
          where: {id: parseInt(id, 10)},
          data: updateData, // Use the data without the id field
        });
  
        return {...user, id: String(user.id)};
      },
  
      // Add missing methods from the standard adapter with ID conversion
      linkAccount: async (data) => {
        // Convert the userId from string to number
        const userId = parseInt(data.userId, 10);
        await prisma.account.create({
          data: {
            ...data,
            userId,
          },
        });
        // Google reports the email it has verified, so from this link on the row's email is a confirmed one (the email
        // typed at a password sign-up never is: _lib/auth/googleLink.ts)
        await prisma.player.updateMany({where: {id: userId, emailVerified: null}, data: {emailVerified: new Date()}});
        // Return void as expected by NextAuth
      },
  
      createSession: async (data) => {
        const session = await prisma.session.create({
          data: {
            ...data,
            userId: parseInt(data.userId, 10),
          },
        });
        return {
          ...session,
          userId: String(session.userId),
        };
      },
  
      getSessionAndUser: async (sessionToken) => {
        const sessionAndUser = await prisma.session.findUnique({
          where: {sessionToken},
          include: {user: true},
        });
        if (!sessionAndUser) return null;
  
        const {user, ...session} = sessionAndUser;
        return {
          session: {
            ...session,
            userId: String(session.userId),
          },
          user: {
            ...user,
            id: String(user.id),
          },
        };
      },
  
      deleteSession: async (sessionToken) => {
        await prisma.session.delete({
          where: {sessionToken},
        });
        // Return void as expected by NextAuth
      }
    };
  }
  
  const customAdapter = CustomPrismaAdapter();

// The player logged in with a password in this browser, if any. The signIn callback runs inside the NextAuth route
// handler, so the request's own cookies are readable there; a Google login started outside a request (or a cookie that
// no longer belongs to a session) is no proof, so it answers null and nothing is linked.
// The session row is read straight from the database, not through `lucia`: this file is also imported by the
// middleware, which runs on the edge, and the Lucia instance reaches into the Prisma client as it is built.
async function passwordSessionPlayerId(): Promise<number | null> {
  try {
    const signed = cookies().get(process.env.AUTH_COOKIE);
    if (!signed?.value) return null;
    const sessionId = extractCookieWithoutSignature(signed)?.value;
    if (!sessionId) return null;
    const session = await prisma.luciaSession.findUnique({where: {id: sessionId}, select: {userId: true, expiresAt: true}});
    if (!session || session.expiresAt <= new Date()) return null;
    return session.userId;
  } catch {
    return null;
  }
}

// What this Google login may do: open the player linked to this Google account, else the one NextAuth links by email
// (ignoring case, the oldest first, as getUserByEmail) — see _lib/auth/googleLink.ts for which links are made.
// A database error is thrown: NextAuth turns it into AccessDenied, which Prijava shows as a failed Google login.
async function googleLoginDecision(
  account: {provider: string; providerAccountId: string} | null,
  email: string | null | undefined,
): Promise<GoogleLinkDecision> {
  const linked = account
    ? await prisma.account.findUnique({
        where: {provider_providerAccountId: {provider: account.provider, providerAccountId: account.providerAccountId}},
        select: {user: {select: {active: true}}},
      })
    : null;
  const byEmail =
    !linked?.user && email
      ? await prisma.player.findFirst({
          where: {email: anyCase(email)},
          orderBy: {id: "asc"},
          select: {id: true, active: true, password_hash: true},
        })
      : null;
  const needsProof = !linked?.user && byEmail?.active === true && byEmail.password_hash !== "";
  return googleLinkDecision({
    linked: linked?.user ?? null,
    byEmail: byEmail ? {id: byEmail.id, active: byEmail.active, hasPassword: byEmail.password_hash !== ""} : null,
    // only read when it can decide anything, so an ordinary Google login costs no extra query
    sessionPlayerId: needsProof ? await passwordSessionPlayerId() : null,
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: customAdapter as Adapter,
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // A player who signed up with a password and later uses Google with the same email gets into the same account
    // instead of an "account not linked" error. Google verifies its emails; the email given at a password sign-up
    // is not verified (see BACKEND_REVIEW.md, G), so the signIn callback below decides which of those links is made
    // (_lib/auth/googleLink.ts) — NextAuth on its own would link by email alone.
    allowDangerousEmailAccountLinking: true,
  })],
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      name: process.env.GOOGLE_AUTH_COOKIE,
      options: googleSessionCookieOptions,
    },
  },
  callbacks: {
    // a deactivated player can't log in with Google either, and neither does a Google email that belongs to a password
    // account nobody has logged into here: back to Prijava with the app's own code (not AccessDenied, which NextAuth
    // also gives for any error in this callback), which shows "Račun je deaktiviran…" / "Prijavi se lozinkom…"
    signIn: async ({account, user}) => {
      const decision = await googleLoginDecision(account, user.email);
      if (decision === "allow") return true;
      return `/login?error=${decision === "deactivated" ? ACCOUNT_DEACTIVATED_CODE : PASSWORD_ACCOUNT_CODE}`;
    },
  },
  // failed or refused Google logins come back to the app's own login page with ?error= (not NextAuth's pages)
  pages: {signIn: "/login", error: "/login"},
  //debug: true,
})

// export const {handlers: {GET, POST}, auth, signIn, signOut} = NextAuth({
//  adapter: customAdapter as Adapter,
//  providers: [
//    Google({
//      clientId: process.env.GOOGLE_CLIENT_ID || "",
//      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
//    }),
//  ],
//   // Add CSRF protection settings
//   secret: process.env.NEXTAUTH_SECRET,
// 
//   session: {
//     strategy: "database",
//     maxAge: 4 * 60 * 60, // 4 hours
//     updateAge: 60 * 15, // 15 minutes
//   },
// 
//   cookies: {
//     sessionToken: {
//       name: process.env.GOOGLE_AUTH_COOKIE,
//       options: {
//         httpOnly: true,
//         sameSite: "lax",
//         path: "/",
//         secure: process.env.NODE_ENV === "production",
//       },
//     },
//   },
// 
//   callbacks: {
//     async session({session, user}) {
//       // Add user ID to the session
//       if (session?.user) {
//         session.user.id = user.id;
//         if (user.username) {
//           session.user.username = user.username;
//         }
//       }
//       return session;
//     },
//   },
//   pages: {
//     signIn: '/login',
//   },
// });
