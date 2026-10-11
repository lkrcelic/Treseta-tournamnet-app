import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";
import {ResultResponse} from "@/app/_interfaces/result";
import {CUSTOM_HAND_MAX, HAND_POINTS} from "@/app/_lib/game/scoring";

// The hand being entered on the scoreboard (phone screen or desktop panel). Persisted, so a reload mid-entry keeps it.
//   normal: the active team's points are typed, the other team gets the rest of 11
//   custom: the "Custom" key, each team's points are typed on their own (akuže and the like)

type ResultTypeExtended = Partial<ResultResponse> & {
  team1_game_points: number;
  team2_game_points: number;
  custom: boolean;
  activeTeam: "team1" | "team2";
};

export type ResultState = {
  resultData: ResultTypeExtended;
  // the next digit starts a new number instead of being appended (after switching team or opening a saved hand)
  startNewNumber: boolean;
  setActiveTeam: (team: "team1" | "team2") => void;
  setGamePoints: (digit: number) => void;
  toggleCustom: () => void;
  resetScore: () => void;
  setMatchId: (id: number) => void;
  resetResult: () => void;
  setResultData: (data: ResultResponse) => void;
};

const initialState = {
  resultData: {
    team1_game_points: 0,
    team2_game_points: 0,
    custom: false,
    activeTeam: "team1" as "team1" | "team2",
  },
};

const useResultStore = create<ResultState>()(
  persist<ResultState>(
    (set) => ({
      ...initialState,
      startNewNumber: false,

      setResultData: (data: ResultResponse) =>
        set((state) => ({
          resultData: {...state.resultData, ...data, custom: data.custom ?? false},
          startNewNumber: true,
        })),

      resetResult: () => set({resultData: {...initialState.resultData}, startNewNumber: false}),

      setActiveTeam: (team) =>
        set((state) => ({
          resultData: {...state.resultData, activeTeam: team},
          startNewNumber: true,
        })),

      setMatchId: (id) =>
        set((state) => ({
          resultData: {...state.resultData, match_id: id},
        })),

      setGamePoints: (digit: number) =>
        set((state) => {
          const {
            resultData: {activeTeam, team1_game_points, team2_game_points, custom},
            startNewNumber,
          } = state;
          const active = activeTeam === "team1" ? team1_game_points : team2_game_points;
          const newScore = (startNewNumber ? 0 : active) * 10 + digit;

          if (custom) {
            // each team on its own; the other team's points stay
            if (newScore > CUSTOM_HAND_MAX) return state;
            return {
              resultData: {
                ...state.resultData,
                team1_game_points: activeTeam === "team1" ? newScore : team1_game_points,
                team2_game_points: activeTeam === "team2" ? newScore : team2_game_points,
              },
              startNewNumber: false,
            };
          }

          // the other team gets the rest of 11
          if (newScore > HAND_POINTS) return state;
          return {
            resultData: {
              ...state.resultData,
              team1_game_points: activeTeam === "team1" ? newScore : HAND_POINTS - newScore,
              team2_game_points: activeTeam === "team2" ? newScore : HAND_POINTS - newScore,
            },
            startNewNumber: false,
          };
        }),

      // Switching between normal and custom entry keeps the points typed so far
      toggleCustom: () =>
        set((state) => ({
          resultData: {...state.resultData, custom: !state.resultData.custom},
          startNewNumber: true,
        })),

      resetScore: () =>
        set((state) => ({
          resultData: {...state.resultData, team1_game_points: 0, team2_game_points: 0},
          startNewNumber: true,
        })),
    }),
    {
      name: "result-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useResultStore;
