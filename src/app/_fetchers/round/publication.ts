import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {DraftNight} from "@/app/_interfaces/round";

// Upravljanje ligom · Skica: a night's rounds, approving one, publishing the approved ones and discarding the draft

async function send<T>(url: string, method: string, fallback: string): Promise<T> {
  const response = await apiFetch(url, {method});
  if (!response.ok) throw new Error(await responseErrorMessage(response, fallback));
  return response.json();
}

export const getDraftNightAPI = (leagueId: number, date: string) =>
  send<DraftNight>(`/api/leagues/${leagueId}/nights/${date}/draft`, "GET", "Kola se nisu učitala.");

// roundId: any table of the round; approve false takes the approval back
export const setRoundApprovalAPI = (roundId: number, approve: boolean) =>
  send<{status: string}>(`/api/rounds/${roundId}/${approve ? "approve" : "unapprove"}`, "PATCH", approve ? "Kolo nije odobreno." : "Odobrenje nije poništeno.");

// "Odobri sva": approves every draft round of the night
export const approveNightAPI = (leagueId: number, date: string) =>
  send<{rounds: number[]}>(`/api/leagues/${leagueId}/nights/${date}/approve`, "POST", "Kola nisu odobrena.");

export const publishNightAPI = (leagueId: number, date: string) =>
  send<{rounds: number[]; publishedAt: string}>(`/api/leagues/${leagueId}/nights/${date}/publish`, "POST", "Kola nisu objavljena.");

export const discardDraftAPI = (leagueId: number, date: string) =>
  send<{rounds: number[]; tables: number}>(`/api/leagues/${leagueId}/nights/${date}/draft`, "DELETE", "Skica nije odbačena.");
