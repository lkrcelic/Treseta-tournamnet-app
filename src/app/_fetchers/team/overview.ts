import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {TeamOverview} from "@/app/_interfaces/profiles";

// The Team page; null when there is no such team (404)
export async function getTeamOverviewAPI(teamId: number): Promise<TeamOverview | null> {
  const response = await apiFetch(`/api/teams/${teamId}/overview`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Ekipa se nije učitala."));
  return response.json();
}
