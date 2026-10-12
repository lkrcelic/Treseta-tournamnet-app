import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";

export async function getAllMatchesByRoundIdAPI(roundId: number): Promise<unknown> {
  const response = await apiFetch(`/api/rounds/${roundId}/matches`);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Mečevi se nisu učitali."));
  }
  return response.json();
}
