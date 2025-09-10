import { MatchExtendedResponse } from "@/app/_interfaces/match";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type MatchState = {
  match: MatchExtendedResponse;
  setMatch: (data: MatchExtendedResponse) => void;
  resetMatchStore: () => void;
};

const useMatchStore = create<MatchState>()(
  persist<MatchState>(
    (set) => ({
      match: {
        team1_score: 0,
        team2_score: 0,
        results: [],
      },

      setMatch: (data: MatchExtendedResponse) =>
        set((state) => ({
          match: {...state.match, ...data},
        })),

      resetMatchStore: () =>
        set((state) => ({
          match: {
            team1_score: 0,
            team2_score: 0,
            results: [],
          },
        })),
    }),
    {
      name: "match-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useMatchStore;
