// src/store/announcementStore.ts
import {create} from 'zustand';
import {PlayerPairResponse} from "@/app/_interfaces/playerPair";
import {BelaPlayerAnnouncementResponse} from "@/app/_interfaces/belaPlayerAnnouncement";
import {createJSONStorage, persist} from "zustand/middleware";

type PlayerAnnouncements = {
  totalAnnouncements: number;
  team: 'TEAM_ONE' | 'TEAM_TWO';
  cardCount: number,
  announcementCounts: { [key: number]: number };
};

export type PlayersAnnouncements = { [key: number]: PlayerAnnouncements };

type AnnouncementState = {
  playersAnnouncements: PlayersAnnouncements;
  activePlayerId: number | null;
  noAnnouncements: boolean;

  setActivePlayerId: (playerId: number | undefined) => void;
  setAnnouncement: (playerId: number | null, points: number) => void;
  resetPlayerAnnouncements: (playerId: number) => void;
  resetAnnouncements: () => void;
  initializePlayersAnnouncements: (
    playerPair1: PlayerPairResponse | null,
    playerPair2: PlayerPairResponse | null
  ) => void;
  setPlayersAnnouncements: (data: BelaPlayerAnnouncementResponse[]) => void;
};

const initialState = {
  playersAnnouncements: {}, 
  activePlayerId: null,
  noAnnouncements: true,
};

const PrismaAnnouncementEnumValueMap = {
  "TWENTY": 20,
  "FIFTY": 50,
  "ONE_HUNDRED": 100,
  "ONE_HUNDRED_FIFTY": 150,
  "TWO_HUNDRED": 200,
};

const PrismaAnnouncementCardCountMap = {20: 3, 50: 4, 100: 4, 150: 4, 200: 4,};

const useAnnouncementStore = create<AnnouncementState>()(persist<AnnouncementState>((set) => ({
    ...initialState,

    initializePlayersAnnouncements: (playerPair1, playerPair2) => set(() => ({
      playersAnnouncements: {
        [playerPair1!.player_id1]: {totalAnnouncements: 0, announcementCounts: {}, cardCount: 0, team: "TEAM_ONE"},
        [playerPair1!.player_id2]: {totalAnnouncements: 0, announcementCounts: {}, cardCount: 0, team: "TEAM_ONE"},
        [playerPair2!.player_id1]: {totalAnnouncements: 0, announcementCounts: {}, cardCount: 0, team: "TEAM_TWO"},
        [playerPair2!.player_id2]: {totalAnnouncements: 0, announcementCounts: {}, cardCount: 0, team: "TEAM_TWO"},
      },
    })),

    setPlayersAnnouncements: (data: BelaPlayerAnnouncementResponse[]) => set((state) => {
      const updatedPlayersAnnouncements: PlayersAnnouncements = {...state.playersAnnouncements};

      data.forEach((announcement) => {
        const {player_id, announcement_type} = announcement;
        const announcementValue = PrismaAnnouncementEnumValueMap[announcement_type];

        if (announcementValue !== undefined && updatedPlayersAnnouncements[player_id]) {
          const playerAnn = updatedPlayersAnnouncements[player_id];
          playerAnn.announcementCounts[announcementValue] = (playerAnn.announcementCounts[announcementValue] || 0) + 1;
          playerAnn.totalAnnouncements = Object.entries(playerAnn.announcementCounts).reduce(
            (total, [pointValue, count]) => total + Number(pointValue) * count, 0
          );
        }
      });

      const hasAnnouncements = Object.values(updatedPlayersAnnouncements).some(
        (player) => player.totalAnnouncements > 0
      );

      return {
        playersAnnouncements: updatedPlayersAnnouncements,
        noAnnouncements: !hasAnnouncements,
      };
    }),

    resetAnnouncements:
      () => set(() => ({...initialState})),

    setActivePlayerId:
      (playerId) => set({activePlayerId: playerId ?? null}),

    setAnnouncement:
      (playerId, points) =>
        set((state) => {

          if (!playerId) {
            return state;
          }

          const playerAnnouncements = state.playersAnnouncements[playerId];
          if (!playerAnnouncements) {
            return state;
          }

          const updatedCardCount = playerAnnouncements.cardCount + PrismaAnnouncementCardCountMap[points];
          if (updatedCardCount > 11) { // 9 for bela
            return state;
          }

          const updatedAnnouncementCounts = {
            ...playerAnnouncements.announcementCounts,
            [points]: (playerAnnouncements.announcementCounts[points] || 0) + 1,
          };


          const totalAnnouncements = Object.entries(updatedAnnouncementCounts).reduce(
            (total, [pointValue, count]) => total + Number(pointValue) * count,
            0
          );

          const updatedPlayersAnnouncements = {
            ...state.playersAnnouncements,
            [playerId]: {
              ...playerAnnouncements,
              totalAnnouncements,
              announcementCounts: updatedAnnouncementCounts,
              cardCount: updatedCardCount,
            },
          };

          const hasAnnouncements = Object.values(updatedPlayersAnnouncements).some(
            (player) => player.totalAnnouncements > 0
          );

          return {
            playersAnnouncements: updatedPlayersAnnouncements,
            noAnnouncements: !hasAnnouncements,
          };
        }),

    resetPlayerAnnouncements:
      (playerId) =>
        set((state) => {
          const player = state.playersAnnouncements[playerId];
          if (!player) {
            return state;
          }

          const updatedPlayersAnnouncements = {
            ...state.playersAnnouncements,
            [playerId]: {
              ...player,
              totalAnnouncements: 0,
              cardCount: 0,
              announcementCounts: {},
            },
          };
          const hasAnnouncements = Object.values(updatedPlayersAnnouncements).some(
            (player) => player.totalAnnouncements > 0
          );
          return {
            playersAnnouncements: updatedPlayersAnnouncements,
            noAnnouncements: !hasAnnouncements,
          };
        }),
  }), {
    name: 'announcement-store',
    storage: createJSONStorage(() => localStorage),
  }
));

export default useAnnouncementStore;
