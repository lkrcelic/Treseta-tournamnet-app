import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {CreateRoundDraft} from "@/app/_lib/createRoundDraft";

// The logged-in admin's Novo kolo for the league tonight (null: nothing changed tonight)
export async function getCreateRoundDraftAPI(leagueId: number): Promise<CreateRoundDraft | null> {
  const response = await apiFetch(`/api/leagues/${leagueId}/create-round-draft`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Odabir za novo kolo se nije učitao."));
  return (await response.json()).draft;
}

// keepalive: sent while the page closes
export async function saveCreateRoundDraftAPI(leagueId: number, draft: CreateRoundDraft, keepalive = false): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/create-round-draft`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(draft),
    keepalive,
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Odabir za novo kolo nije spremljen."));
}
