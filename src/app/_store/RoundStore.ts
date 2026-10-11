import { RoundExtendedResponse } from "@/app/_interfaces/round";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type RoundState = {
  roundData: RoundExtendedResponse;
  resetRound: () => void;
  setRoundData: (data: RoundExtendedResponse) => void;
};

const initialRoundData = {
  team1_id: null,
  team2_id: null,
} as RoundExtendedResponse;

const useRoundStore = create<RoundState>()(
  persist(
    (set) => ({
      roundData: initialRoundData,

      setRoundData: (data) => set((state) => ({roundData: {...state.roundData, ...data}})),

      resetRound: () => {
        // components destructure roundData, so it is reset to the empty shape instead of null
        set({
          roundData: initialRoundData,
        });
      },
    }),
    {
      name: "round-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useRoundStore;
