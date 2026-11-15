import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {DraftNight} from "@/app/_interfaces/round";
import {Slot, slotQuery} from "@/app/_lib/locations";

// Upravljanje ligom · Skica: a night's rounds, approving one, publishing the approved ones and discarding the draft;
// slot: at one place of a two-place night (null: a one-place night)

async function send<T>(url: string, method: string, fallback: string): Promise<T> {
  const response = await apiFetch(url, {method});
  if (!response.ok) throw new Error(await responseErrorMessage(response, fallback));
  return response.json();
}

export const getDraftNightAPI = (leagueId: number, date: string, slot: Slot | null = null) =>
  send<DraftNight>(`/api/leagues/${leagueId}/nights/${date}/draft${slotQuery(slot)}`, "GET", "Kola se nisu učitala.");

// roundId: any table of the round; approve false takes the approval back
export const setRoundApprovalAPI = (roundId: number, approve: boolean) =>
  send<{status: string}>(`/api/rounds/${roundId}/${approve ? "approve" : "unapprove"}`, "PATCH", approve ? "Kolo nije odobreno." : "Odobrenje nije poništeno.");

// "Odobri sva": approves every draft round of the night
export const approveNightAPI = (leagueId: number, date: string, slot: Slot | null = null) =>
  send<{rounds: number[]}>(`/api/leagues/${leagueId}/nights/${date}/approve${slotQuery(slot)}`, "POST", "Kola nisu odobrena.");

export const publishNightAPI = (leagueId: number, date: string, slot: Slot | null = null) =>
  send<{rounds: number[]; publishedAt: string}>(`/api/leagues/${leagueId}/nights/${date}/publish${slotQuery(slot)}`, "POST", "Kola nisu objavljena.");

export const discardDraftAPI = (leagueId: number, date: string, slot: Slot | null = null) =>
  send<{rounds: number[]; tables: number}>(`/api/leagues/${leagueId}/nights/${date}/draft${slotQuery(slot)}`, "DELETE", "Skica nije odbačena.");
