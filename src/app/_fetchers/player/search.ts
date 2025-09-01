import {PlayerPartialResponse} from "@/app/_interfaces/player";

export async function searchPlayersAPI(query: string): Promise<PlayerPartialResponse[]> {
  const response = await fetch(`/api/players?query=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch team data: ${response.statusText}`);
  }
  return response.json();
}