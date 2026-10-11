import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {SmokingPlan} from "@/app/_interfaces/smoking";

// Tonight's smoking tables and the league's smoking rotation (admin only)
export async function getSmokingPlanAPI(leagueId: number): Promise<SmokingPlan> {
  const response = await fetch(`/api/leagues/${leagueId}/smoking`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Plan pušačkih stolova nije moguće učitati"));
  return response.json();
}
