import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// needs_birth_date: a Google sign-up that hasn't given a birth date yet (the app asks)
export type AuthUser = { id: number; username: string; needs_birth_date?: boolean } | null;

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
