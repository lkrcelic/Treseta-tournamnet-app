import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {TableOverview} from "@/app/_interfaces/adminHand";

// A table that doesn't exist, or whose round isn't published yet (Stol ne postoji)
export class TableNotFoundError extends Error {}

// Pregled stola: a table's matches and hands, read-only, for anyone signed in
export async function getTableOverviewAPI(roundId: number): Promise<TableOverview> {
  const response = await apiFetch(`/api/rounds/${roundId}/overview`);
  if (response.status === 404) throw new TableNotFoundError("Stol ne postoji.");
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Stol se nije učitao."));
  return response.json();
}
