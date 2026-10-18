import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// needs_birth_date: a Google sign-up that hasn't given a birth date yet (the app asks); needs_smoker: hasn't answered
// "Pušiš li?" yet (asked after the birth date); is_admin: shows the admin menus (the server checks every admin call);
// photo_url: the player's own photo (null = the initials)
export type AuthUser = {
  id: number;
  username: string;
  is_admin?: boolean;
  needs_birth_date?: boolean;
  needs_smoker?: boolean;
  photo_url?: string | null;
} | null;

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
