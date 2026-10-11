import {create} from "zustand";
import {OngoingMatchResponse, OngoingMatchExtendedResponse} from "@/app/_interfaces/match";
import {createJSONStorage, persist} from "zustand/middleware";

export type OngoingMatchState = {
  ongoingMatch: OngoingMatchExtendedResponse;
  setOngoingMatch: (data: OngoingMatchExtendedResponse) => void;
  resetOngoingMatch: () => void;
};

const useOngoingMatchStore = create<OngoingMatchState>()(
  persist<OngoingMatchState>(
    (set) => ({
      ongoingMatch: {
        player_pair1_score: 0,
        player_pair2_score: 0,
        results: [],
      },

      setOngoingMatch: (data: OngoingMatchResponse) =>
        set((state) => ({
          ongoingMatch: {...state.ongoingMatch, ...data},
        })),

      resetOngoingMatch: () =>
        set(() => ({
          ongoingMatch: {
            player_pair1_score: 0,
            player_pair2_score: 0,
            results: [],
          },
        })),
    }),
    {
      name: "ongoing-match-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export default useOngoingMatchStore;
