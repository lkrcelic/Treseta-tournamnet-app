import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Capability } from "@/app/_lib/auth/permissions";
import type { Role } from "@/app/_lib/auth/roles";

// needs_birth_date: a Google sign-up that hasn't given a birth date yet (the app asks); needs_smoker: hasn't answered
// "Pušiš li?" yet (asked after the birth date); is_admin: shows the admin menus (the server checks every admin call);
// photo_url: the player's own photo (null = the initials); role and can: who the player is and what they may do
// (useCan), filled by /api/auth/me on every app load
export type AuthUser = {
  id: number;
  username: string;
  is_admin?: boolean;
  needs_birth_date?: boolean;
  needs_smoker?: boolean;
  photo_url?: string | null;
  role?: Role;
  can?: Capability[];
} | null;

/**
 * Whether the stored user may do this (cap left out: whether they manage anything at all). The one reader of `can`,
 * so the hooks, the menu and the pages all ask the same question (DECISIONS #86).
 *
 * A user stored before the roles came in has no `can` yet — /api/auth/me fills it on this very load. Until it does,
 * an admin still gets everything from `is_admin`, so the first paint after a deploy isn't the player's view.
 */
export function userCan(user: AuthUser, cap?: Capability): boolean {
  if (!user) return false;
  if (user.can) return cap == null ? user.can.length > 0 : user.can.includes(cap);
  return user.is_admin === true;
}

type AuthState = {
  user: AuthUser;
  setUser: (user: AuthUser) => void;
  reset: () => void;
};

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      reset: () => set({ user: null }),
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useAuthStore;
