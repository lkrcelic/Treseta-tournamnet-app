import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";
import {ResultResponse} from "@/app/_interfaces/result";
import {canAddZvanje, CUSTOM_HAND_MAX, HAND_POINTS, NO_ZVANJA, Zvanje, ZvanjaCounts} from "@/app/_lib/game/scoring";

// The hand being entered on the scoreboard (phone screen or desktop panel). Persisted, so a reload mid-entry keeps it.
//   normal: the active team's points are typed, the other team gets the rest of 11, and each team's zvanja are clicked
//   custom: the "Custom" key, each team's points are typed on their own (a hand cut short by "s ovim dosta"), with no
//           zvanja: the typed points are the hand's total

type TeamKey = "team1" | "team2";

type ResultTypeExtended = Partial<ResultResponse> & {
  team1_game_points: number;
  team2_game_points: number;
  custom: boolean;
  activeTeam: TeamKey;
  // each team's zvanja on the hand, by value
  zvanja: Record<TeamKey, ZvanjaCounts>;
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
  // one more zvanje of the value for the active team
  addZvanje: (value: Zvanje) => void;
  // the active team's zvanja cleared (Obriši zvanja)
  clearZvanja: () => void;
};

const noZvanja = (): Record<TeamKey, ZvanjaCounts> => ({team1: {...NO_ZVANJA}, team2: {...NO_ZVANJA}});

const initialState = {
  resultData: {
    team1_game_points: 0,
    team2_game_points: 0,
    custom: false,
    activeTeam: "team1" as TeamKey,
    zvanja: noZvanja(),
  },
};

// The store's version: 1 added the zvanja (an entry kept from before has none)
export const RESULT_STORE_VERSION = 1;

export function migrateResultStore(persisted: unknown, version: number): ResultState {
  const state = (persisted ?? {}) as ResultState;
  if (version < 1 && state.resultData) state.resultData = {...state.resultData, zvanja: noZvanja()};
  return state;
}

const useResultStore = create<ResultState>()(
  persist<ResultState>(
    (set) => ({
      ...initialState,
      startNewNumber: false,

      setResultData: (data: ResultResponse) =>
        set((state) => ({
          resultData: {
            ...state.resultData,
            ...data,
            custom: data.custom ?? false,
            zvanja: {
              team1: {3: data.team1_zvanja3 ?? 0, 4: data.team1_zvanja4 ?? 0},
              team2: {3: data.team2_zvanja3 ?? 0, 4: data.team2_zvanja4 ?? 0},
            },
          },
          startNewNumber: true,
        })),

      resetResult: () => set({resultData: {...initialState.resultData, zvanja: noZvanja()}, startNewNumber: false}),

      addZvanje: (value) =>
        set((state) => {
          const {activeTeam, zvanja} = state.resultData;
          // a click the cards can't make (a second tap before the button went off) is ignored
          if (!canAddZvanje(zvanja.team1, zvanja.team2, activeTeam === "team1" ? 1 : 2, value)) return state;
          const team = zvanja[activeTeam];
          return {resultData: {...state.resultData, zvanja: {...zvanja, [activeTeam]: {...team, [value]: team[value] + 1}}}};
        }),

      clearZvanja: () =>
        set((state) => {
          const {activeTeam, zvanja} = state.resultData;
          return {resultData: {...state.resultData, zvanja: {...zvanja, [activeTeam]: {...NO_ZVANJA}}}};
        }),

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

      // Switching between normal and custom entry keeps the points typed so far; a custom hand has no zvanja, so they
      // go
      toggleCustom: () =>
        set((state) => ({
          resultData: {...state.resultData, custom: !state.resultData.custom, zvanja: noZvanja()},
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
      version: RESULT_STORE_VERSION,
      migrate: migrateResultStore,
    }
  )
);

export default useResultStore;
