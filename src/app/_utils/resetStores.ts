import useAuthStore from "@/app/_store/authStore";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import useAnnouncementStore from "@/app/_store/bela/announcementStore";
import useResultStore from "@/app/_store/bela/resultStore";
import useRoundStore from "@/app/_store/RoundStore";

export function resetAllStores() {
  useAuthStore.getState().reset();

  useOngoingMatchStore.getState().hardResetOngoingMatch();

  useAnnouncementStore.getState().resetAnnouncements();

  useResultStore.getState().resetResult();

  useRoundStore.getState().resetRound();
}
