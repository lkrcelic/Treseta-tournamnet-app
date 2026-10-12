// Adds fields to the next-auth types. The export makes this file a module, so the blocks below extend "next-auth"
// instead of replacing it (as a plain script they declared a new "next-auth" without NextAuth() in it).
export {};

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string | null;
    };
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    username?: string;
  }
}
