import useAuthStore from "@/app/_store/authStore";
import useMatchStore from "@/app/_store/matchStore";
import useRoundStore from "@/app/_store/roundStore";
import useResultStore from "@/app/_store/resultStore";

export function resetAllStores() {
  useAuthStore.getState().reset();

  useMatchStore.getState().resetMatchStore();

  useResultStore.getState().resetResult();

  useRoundStore.getState().resetRound();
}
