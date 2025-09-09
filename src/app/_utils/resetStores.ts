import useAuthStore from "@/app/_store/authStore";
import useMatchStore from "@/app/_store/matchStore";
import useResultStore from "@/app/_store/resultStore";
import useRoundStore from "@/app/_store/roundStore";

export function resetAllStores() {
  useAuthStore.getState().reset();

  useMatchStore.getState().resetMatchStore();

  useResultStore.getState().resetResult();

  useRoundStore.getState().resetRound();
}
