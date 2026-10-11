import useAuthStore from "@/app/_store/authStore";
import useOngoingMatchStore from "@/app/_store/ongoingMatchStore";
import useResultStore from "@/app/_store/game/resultStore";
import useRoundStore from "@/app/_store/RoundStore";

// Asks the server who is logged in and stores that user. When it is someone else than the stored user (a login as
// another player, an expired session), the previous player's round and hand data are dropped.
// Returns the HTTP status, or null when the server couldn't be reached. A server error keeps the stored user.
export async function refreshUser(): Promise<number | null> {
  let res: Response;
  try {
    res = await fetch("/api/auth/me", {credentials: "include"});
  } catch {
    return null; // offline: keep the stored user
  }
  if (res.status >= 500) return res.status;

  const json = res.ok ? await res.json().catch(() => null) : null;
  const freshUser = json?.user ?? null;
  if (useAuthStore.getState().user?.id !== freshUser?.id) {
    useOngoingMatchStore.getState().resetOngoingMatch();
    useResultStore.getState().resetResult();
    useRoundStore.getState().resetRound();
  }
  useAuthStore.getState().setUser(freshUser);
  return res.status;
}
