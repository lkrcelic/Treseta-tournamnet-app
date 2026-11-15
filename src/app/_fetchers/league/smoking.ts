import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {SmokingPlan} from "@/app/_interfaces/smoking";
import {Slot, slotQuery} from "@/app/_lib/locations";

// Tonight's smoking tables and the league's smoking rotation (admin only); slot: tonight's rounds at that place
export async function getSmokingPlanAPI(leagueId: number, slot: Slot | null = null): Promise<SmokingPlan> {
  const response = await apiFetch(`/api/leagues/${leagueId}/smoking${slotQuery(slot)}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Pušački raspored se nije učitao."));
  return response.json();
}
