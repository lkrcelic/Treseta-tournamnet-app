import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {CreateRoundDraft} from "@/app/_lib/createRoundDraft";
import {Slot, slotQuery} from "@/app/_lib/locations";

// The logged-in admin's Novo kolo for the league tonight (null: nothing changed tonight); slot: one place's of a
// two-place night
export async function getCreateRoundDraftAPI(leagueId: number, slot: Slot | null = null): Promise<CreateRoundDraft | null> {
  const response = await apiFetch(`/api/leagues/${leagueId}/create-round-draft${slotQuery(slot)}`);
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Odabir za novo kolo se nije učitao."));
  return (await response.json()).draft;
}

// keepalive: sent while the page closes
export async function saveCreateRoundDraftAPI(leagueId: number, draft: CreateRoundDraft, keepalive = false, slot: Slot | null = null): Promise<void> {
  const response = await apiFetch(`/api/leagues/${leagueId}/create-round-draft${slotQuery(slot)}`, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(draft),
    keepalive,
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Odabir za novo kolo nije spremljen."));
}
