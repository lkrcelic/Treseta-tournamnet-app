import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import {PlayerPartialResponse} from "@/app/_interfaces/player";

export async function searchPlayersAPI(query: string): Promise<PlayerPartialResponse[]> {
  const response = await apiFetch(`/api/players?query=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Igrači se nisu učitali."));
  }
  return response.json();
}