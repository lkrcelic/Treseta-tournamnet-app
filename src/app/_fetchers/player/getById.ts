import { PlayerResponse, PlayerResponseValidation } from "@/app/_interfaces/player";

export async function getPlayerByIdAPI(id: number): Promise<PlayerResponse> {
  const res = await fetch(`/api/players/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch player ${id}: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return PlayerResponseValidation.parse(json);
}