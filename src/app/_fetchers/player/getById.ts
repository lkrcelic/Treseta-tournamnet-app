import { PlayerResponseValidation } from "@/app/_interfaces/player";
import { z } from "zod";

// birth_date (YYYY-MM-DD) is only sent to the player themselves and to admins
const PlayerByIdValidation = PlayerResponseValidation.extend({ birth_date: z.string().nullable().optional() });
export type PlayerById = z.infer<typeof PlayerByIdValidation>;

export async function getPlayerByIdAPI(id: number): Promise<PlayerById> {
  const res = await fetch(`/api/players/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch player ${id}: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return PlayerByIdValidation.parse(json);
}
