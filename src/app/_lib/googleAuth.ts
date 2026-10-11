import NextAuth from "next-auth"
import {PrismaAdapter} from "@auth/prisma-adapter";
import {prisma} from "@/app/_lib/prisma";
import {Adapter} from "@auth/core/adapters";
import Google from "next-auth/providers/google";
import {googleSessionCookieOptions, SESSION_MAX_AGE_SECONDS} from "@/app/_lib/sessionConfig";
 
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
          where: {email: {equals: email, mode: "insensitive"}},
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
        await prisma.account.create({
          data: {
            ...data,
            userId: parseInt(data.userId, 10),
          },
        });
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: customAdapter as Adapter,
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // A player who signed up with a password and later uses Google with the same email gets into the same account
    // instead of an "account not linked" error. Google verifies its emails; the email given at a password sign-up
    // is not verified (see BACKEND_REVIEW.md, G).
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
