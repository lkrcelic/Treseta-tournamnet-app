import useAuthStore from "@/app/_store/authStore";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import useResultStore from "@/app/_store/game/resultStore";
import useRoundStore from "@/app/_store/RoundStore";

export function resetAllStores() {
  useAuthStore.getState().reset();

  useOngoingMatchStore.getState().resetOngoingMatch();

  useResultStore.getState().resetResult();

  useRoundStore.getState().resetRound();
}
