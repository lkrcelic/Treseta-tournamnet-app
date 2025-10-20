import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {PrismaAdapter} from "@auth/prisma-adapter";
import {prisma} from "@/app/_lib/prisma";
import {Adapter} from "@auth/core/adapters";

/**
 * NextAuth configuration for Google OAuth
 * Using NextAuth v5 beta API
 */

// Create a custom adapter that properly handles the Player model instead of User
function CustomPrismaAdapter() {
  // Start with the standard PrismaAdapter
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
          username: data.email.split('@')[0], // Use part of email as username
          password_hash: "", // Empty password for OAuth users
          player_role: "PLAYER", // Default role - using an enum value from RoleEnum
          first_name: data.name?.split(' ')[0] || "",
          last_name: data.name?.split(' ')[1] || "",
          birth_date: new Date(), // Default date
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

    getUserByEmail: async (email) => {
      const user = await prisma.player.findUnique({
        where: {email},
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

export const {handlers: {GET, POST}, auth, signIn, signOut} = NextAuth({
  adapter: customAdapter as Adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
   session: {
    strategy: "database",
    maxAge: 4 * 60 * 60, // 4 hours in seconds
  },
  cookies: {
    sessionToken: {
      name: process.env.GOOGLE_AUTH_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
