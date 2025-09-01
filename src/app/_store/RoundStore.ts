import {create} from "zustand";
import {RoundType} from "@/app/_interfaces/round";
import { persist } from "zustand/middleware";
import {createJSONStorage} from "zustand/middleware";

export type RoundState = {
    roundData: RoundType;
    resetRound: () => void;
    setRoundData: (data: RoundType) => void;
};

const useRoundStore = create<RoundState>()(persist(
  (set) => ({
    roundData: {
      team1_id: null,
      team2_id: null,
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
