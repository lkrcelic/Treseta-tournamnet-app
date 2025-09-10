import {create} from "zustand";
import {RoundExtendedResponse} from "@/app/_interfaces/round";
import { persist } from "zustand/middleware";
import {createJSONStorage} from "zustand/middleware";

export type RoundState = {
    roundData: RoundExtendedResponse;
    resetRound: () => void;
    setRoundData: (data: RoundExtendedResponse) => void;
};

const useRoundStore = create<RoundState>()(persist(
  (set) => ({
    roundData: {
      team1_id: null,
      team2_id: null,
      team1_wins: 0,
      team2_wins: 0,
    },

    setRoundData: (data) => set((state) => ({roundData: {...state.roundData, ...data}})),

    resetRound: () => {
      set({
            roundData: null
      });
    },
  }),
  {
    name: "round-store",
    storage: createJSONStorage(() => localStorage),
  }
));

export default useRoundStore;
