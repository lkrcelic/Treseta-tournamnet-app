import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {SmokingPlan} from "@/app/_interfaces/smoking";

// Tonight's smoking tables and the league's smoking rotation (admin only)
export async function getSmokingPlanAPI(leagueId: number): Promise<SmokingPlan> {
  const response = await apiFetch(`/api/leagues/${leagueId}/smoking`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Pušački raspored se nije učitao."));
  return response.json();
}
