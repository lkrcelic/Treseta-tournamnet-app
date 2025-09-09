// src/store/scoreStore.ts
import {ResultResponse} from "@/app/_interfaces/result";
import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";

type ResultTypeExtended = ResultResponse & {
  activeTeam: "team1" | "team2";
};

export type ResultState = {
  resultData: ResultTypeExtended;
  customResult: boolean;
  setActiveTeam: (team: "team1" | "team2") => void;
  setGamePoints: (digit: number) => void;
  resetScore: () => void;
  resetResult: () => void;
  setResultData: (data: ResultResponse) => void;
  setCustomResult: () => void;
};

const MAX_SCORE = 11;

const initialState = {
  resultData: {
    complete_victory: false,
    team1_game_points: 0,
    team2_game_points: 0,
    activeTeam: "team1" as const,
  },
  customResult: false,
};

const useResultStore = create<ResultState>()(
  persist<ResultState>(
    (set) => ({
      ...initialState,

      setResultData: (data: ResultResponse) =>
        set((state) => ({
          resultData: {...state.resultData, ...data},
        })),

      setCustomResult: () =>
        set((state) => ({
          customResult: !state.customResult,
        })),

      resetResult: () => set({resultData: {...initialState.resultData}, customResult: false}),

      setActiveTeam: (team) =>
        set((state) => ({
          resultData: {...state.resultData, activeTeam: team},
        })),

      setGamePoints: (digit: number) =>
        set((state) => {
          const { customResult } = state;
          const { activeTeam, team1_game_points, team2_game_points } = state.resultData;
          let newScore, team1UpdatedGamePoints, team2UpdatedGamePoints;

          if (customResult) {
            // Custom mode: independently set the active team's score, do not alter the other team's score
            if (activeTeam === "team1") {
              newScore = team1_game_points * 10 + digit;
              team1UpdatedGamePoints = newScore;
              team2UpdatedGamePoints = team2_game_points;
            }
            if (activeTeam === "team2") {
              newScore = team2_game_points * 10 + digit;
              team2UpdatedGamePoints = newScore;
              team1UpdatedGamePoints = team1_game_points;
            }
          } else {
            // Default mode: scores are complementary and capped to MAX_SCORE
            if (activeTeam === "team1") {
            newScore = team1_game_points * 10 + digit;
              if (newScore > MAX_SCORE) {
                return state;
              }
              team1UpdatedGamePoints = newScore;
              team2UpdatedGamePoints = MAX_SCORE - newScore;
            }
            if (activeTeam === "team2") {
            newScore = team2_game_points * 10 + digit;
              if (newScore > MAX_SCORE) {
                return state;
              }
              team2UpdatedGamePoints = newScore;
              team1UpdatedGamePoints = MAX_SCORE - newScore;
            }
          }

          return {
            resultData: {
              ...state.resultData,
              team1_game_points: team1UpdatedGamePoints,
              team2_game_points: team2UpdatedGamePoints,
            },
          };
        }),

      resetScore: () =>
        set((state) => ({
          resultData: {
            ...state.resultData,
            team1_game_points: 0,
            team2_game_points: 0,
            complete_victory: false,
          },
        })),
    }),
    {
      name: "result-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useResultStore;
