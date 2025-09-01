import {create} from "zustand";
import {OngoingMatchExtendedResponse} from "@/app/_interfaces/match";
import {PlayerPartialResponse} from "@/app/_interfaces/player";
import {createJSONStorage, persist} from "zustand/middleware";

export type OngoingMatchState = {
  ongoingMatch: OngoingMatchExtendedResponse;
  setOngoingMatch: (data: OngoingMatchExtendedResponse) => void;
  softResetOngoingMatch: () => void;
  hardResetOngoingMatch: () => void;
  setSeatingOrder: (newOrder: (PlayerPartialResponse | null)[]) => void;
  createOngoingMatch: (round_id: number) => Promise<number>;
};

const useOngoingMatchStore = create<OngoingMatchState>()(
  persist<OngoingMatchState>(
    (set) => ({
      ongoingMatch: {
        player_pair1_score: 0,
        player_pair2_score: 0,
        current_shuffler_index: 0,
        belaResults: [],
        seating_order: [null, null, null, null],
      },

      setSeatingOrder: (newOrder) =>
        set((state) => ({
          ongoingMatch: {...state.ongoingMatch, seating_order: newOrder},
        })),

      setOngoingMatch: (data: OngoingMatchExtendedResponse) =>
        set((state) => ({
          ongoingMatch: {...state.ongoingMatch, ...data},
        })),

      softResetOngoingMatch: () =>
        set((state) => ({
          ongoingMatch: {
            seating_order: state.ongoingMatch.seating_order || [null, null, null, null],
            player_pair1_score: 0,
            player_pair2_score: 0,
            belaResults: [],
            current_shuffler_index: state.current_shuffler_index || 0,
          },
        })),

      hardResetOngoingMatch: () =>
        set(() => ({
          ongoingMatch: {
            seating_order: [null, null, null, null],
            player_pair1_score: 0,
            player_pair2_score: 0,
            belaResults: [],
            current_shuffler_index: 0,
          },
        })),
    }),
    {
      name: "ongoing-match-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useOngoingMatchStore;
