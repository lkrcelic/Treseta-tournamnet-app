// src/store/scoreStore.ts
import {create} from "zustand";
import {BelaResultResponse} from "@/app/_interfaces/belaResult";
import {PlayerPairResponse} from "@/app/_interfaces/playerPair";
import {PlayerPartialResponse} from "@/app/_interfaces/player";
import {PlayersAnnouncements} from "@/app/_store/bela/announcementStore";
import {BelaPlayerAnnouncementsRequest} from "@/app/_interfaces/belaPlayerAnnouncement";
import {createJSONStorage, persist} from "zustand/middleware";

type BelaResultTypeExtended = BelaResultResponse & {
  activeTeam: "team1" | "team2";
}

export type ResultState = {
  resultData: BelaResultTypeExtended;
  setTrumpCallerId: (playerId?: number) => void;
  setActiveTeam: (team: "team1" | "team2") => void;
  setTotalPoints: (playerPair1?: PlayerPairResponse, playerPair2?: PlayerPairResponse) => ResultState;
  setGamePoints: (digit: number) => void; 
  resetScore: () => void;
  setCompleteVictory: () => void;
  setMatchId: (id: number) => void;
  setCardShufflerIdAndTrumpCallerPosition:
    (seatingOrder: (PlayerPartialResponse | null)[], currentShufflerIndex: number) => void;
  updateAnnouncementPoints: (playerAnnouncements: PlayersAnnouncements) => void;
  resetResult: () => void;
  setResultData: (data: BelaResultResponse) => void;
};

const MAX_SCORE = 162;
const COMPLETE_VICTORY_SCORE = 252;
const PrismaAnnouncementEnumValueMap = {
  20: "TWENTY",
  50: "FIFTY",
  100: "ONE_HUNDRED",
  150: "ONE_HUNDRED_FIFTY",
  200: "TWO_HUNDRED",
};

const initialState = {
  resultData: {
    complete_victory: false,
    player_pair1_game_points: 0,
    player_pair2_game_points: 0,
    player_pair1_announcement_points: 0,
    player_pair2_announcement_points: 0,
    card_shuffler_id: null,
    trumpCallerPosition: null,
    player_pair1_total_points: 0,
    player_pair2_total_points: 0,
    trump_caller_id: null,
    activeTeam: "team1",
  }
};

const useResultStore = create<ResultState>()(persist<ResultState>((set) => ({
    ...initialState,

    setResultData: (data: BelaResultResponse) => set((state) => ({
      resultData: {...state.resultData, ...data}
    })),

    resetResult: () => set({resultData: {...initialState.resultData}}),

    setTrumpCallerId: (playerId) => set((state) => ({
      resultData: {...state.resultData, trump_caller_id: playerId}
    })),

    setActiveTeam: (team) => set((state) => ({
      resultData: {...state.resultData, activeTeam: team}
    })),

    setMatchId: (id) => set((state) => ({
      resultData: {...state.resultData, match_id: id}
    })),

    setCardShufflerIdAndTrumpCallerPosition: (seatingOrder, currentShufflerIndex) => set((state) => {
      const {trump_caller_id} = state.resultData;
      const cardShufflerId = seatingOrder[currentShufflerIndex]?.id;

      const positionsMap = {0: "FIRST", 1: "SECOND", 2: "THIRD", 3: "FOURTH"};

      const trumpCallerIndex = seatingOrder.findIndex(player => player.id === trump_caller_id);
      const relativeDistance = trumpCallerIndex - currentShufflerIndex - 1;
      const relativeIndex = (relativeDistance + seatingOrder.length) % seatingOrder.length
      const trumpCallerPosition = positionsMap[relativeIndex];

      return {
        resultData: {
          ...state.resultData,
          card_shuffler_id: cardShufflerId,
          trump_caller_position: trumpCallerPosition,
        },
      };
    }),


    setGamePoints: (digit: number) => set((state) => {
      const {
        resultData: {
          activeTeam,
          player_pair1_game_points,
          player_pair2_game_points,
        }
      } = state;
      let newScore, pp1UpdatedGamePoints, pp2UpdatedGamePoints;

      if (activeTeam === "team1") {
        newScore = player_pair1_game_points * 10 + digit;
        if (newScore > MAX_SCORE) {
          return state;
        }
        pp1UpdatedGamePoints = newScore;
        pp2UpdatedGamePoints = MAX_SCORE - newScore;
      }

      if (activeTeam === "team2") {
        newScore = player_pair2_game_points * 10 + digit;
        if (newScore > MAX_SCORE) {
          return state;
        }
        pp2UpdatedGamePoints = newScore;
        pp1UpdatedGamePoints = MAX_SCORE - newScore;
      }

      return {
        resultData: {
          ...state.resultData,
          player_pair1_game_points: pp1UpdatedGamePoints,
          player_pair2_game_points: pp2UpdatedGamePoints,
        }
      };
    }),

    setTotalPoints: (playerPair1, playerPair2) => set((state) => {
      const {
        resultData: {
          player_pair1_game_points,
          player_pair2_game_points,
          player_pair1_announcement_points,
          player_pair2_announcement_points,
          trump_caller_id,
          complete_victory,
        }
      } = state;

      const isCallerInPair = (pair) => [pair?.player_id1, pair?.player_id2].includes(trump_caller_id);

      if (trump_caller_id === null) {
        throw new Error("Trump caller ID is not set");
      }

      const playerPair1Called = isCallerInPair(playerPair1);
      const playerPair2Called = isCallerInPair(playerPair2);

      if (!playerPair1Called && !playerPair2Called) {
        throw new Error("Trump caller not from player pairs");
      }

      let PlayerPair1TotalPoints = player_pair1_game_points + player_pair1_announcement_points;
      let PlayerPair2TotalPoints = player_pair2_game_points + player_pair2_announcement_points;

      const allAnnouncements = player_pair2_announcement_points + player_pair1_announcement_points;
      let pass = true;

      if(complete_victory) {
        if (player_pair1_game_points == COMPLETE_VICTORY_SCORE) {
          PlayerPair1TotalPoints = COMPLETE_VICTORY_SCORE + allAnnouncements;
          PlayerPair2TotalPoints = 0;
        } else if (player_pair2_game_points == COMPLETE_VICTORY_SCORE) {
          PlayerPair2TotalPoints = COMPLETE_VICTORY_SCORE + allAnnouncements;
          PlayerPair1TotalPoints = 0;
        }
      } else if (playerPair1Called && PlayerPair1TotalPoints <= PlayerPair2TotalPoints) {
          PlayerPair2TotalPoints = MAX_SCORE + allAnnouncements;
          PlayerPair1TotalPoints = 0;
          pass = false;
      } else if (playerPair2Called &&PlayerPair2TotalPoints <= PlayerPair1TotalPoints) {
          PlayerPair1TotalPoints = MAX_SCORE + allAnnouncements;
          PlayerPair2TotalPoints = 0;
          pass = false;
      }

      return {
        resultData: {
          ...state.resultData,
          player_pair1_total_points: PlayerPair1TotalPoints,
          player_pair2_total_points: PlayerPair2TotalPoints,
          pass: pass,
        }
      };
    }),

    resetScore:
      () =>
        set((state) => ({
          resultData: {
            ...state.resultData,
            player_pair1_game_points: 0,
            player_pair2_game_points: 0,
            player_pair1_total_points: state.resultData.player_pair1_announcement_points,
            player_pair2_total_points: state.resultData.player_pair2_announcement_points,
            complete_victory: false,
          }
        })),

    setCompleteVictory: () => set((state) => {
      const {
        resultData: {
          activeTeam,
          trump_caller_id,
        }
      } = state;
      if (trump_caller_id === null) {
        throw new Error("Trump caller ID is not set");
      }

      if (activeTeam === "team1") {
        return {
          resultData: {
            ...state.resultData,
            complete_victory: true,
            player_pair1_game_points: COMPLETE_VICTORY_SCORE,
            player_pair2_game_points: 0,
          }
        };
      }
      if (activeTeam === "team2") {
        return {
          resultData: {
            ...state.resultData,
            complete_victory: true,
            player_pair1_game_points: 0,
            player_pair2_game_points: COMPLETE_VICTORY_SCORE,
          }
        };
      }
    }),

    updateAnnouncementPoints: (playerAnnouncements: PlayersAnnouncements) => {
      const teamPoints: { [team: string]: number } = {TEAM_ONE: 0, TEAM_TWO: 0};
      const announcements: BelaPlayerAnnouncementsRequest[] = [];

      Object.entries(playerAnnouncements).forEach(([playerIdStr, playerData]) => {
        const playerId = Number(playerIdStr);

        teamPoints[playerData.team] += playerData.totalAnnouncements;

        Object.entries(playerData.announcementCounts).forEach(
          ([announcementTypeStr, count]) => {
            const announcementType = Number(announcementTypeStr);
            for (let i = 0; i < count; i++) {
              announcements.push({
                player_id: playerId,
                announcement_type: PrismaAnnouncementEnumValueMap[announcementType],
              });
            }
          }
        );
      });

      set((state) => {
        const updatedPP1AnnouncementPoints = teamPoints['TEAM_ONE'] || 0;
        const updatedPP2AnnouncementPoints = teamPoints['TEAM_TWO'] || 0;

        const updatedPP1TotalPoints =
          state.resultData.player_pair1_game_points + updatedPP1AnnouncementPoints;
        const updatedPP2TotalPoints =
          state.resultData.player_pair2_game_points + updatedPP2AnnouncementPoints;

        return {
          resultData: {
            ...state.resultData,
            player_pair1_announcement_points: updatedPP1AnnouncementPoints,
            player_pair2_announcement_points: updatedPP2AnnouncementPoints,
            player_pair1_total_points: updatedPP1TotalPoints,
            player_pair2_total_points: updatedPP2TotalPoints,
            announcements: announcements,
          },
        };
      });
    },
  }), {
    name: 'result-store',
    storage: createJSONStorage(() => localStorage),
  }));

export default useResultStore;
