import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AuthUser = { id: number; username: string } | null;

type AuthState = {
  user: AuthUser;
  setUser: (user: AuthUser) => void;
  reset: () => void;
};

// authStore.ts
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
