import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import { PlayerResponseValidation } from "@/app/_interfaces/player";
import { z } from "zod";

// birth_date (YYYY-MM-DD), phone and smoker are only sent to the player themselves and to admins
const PlayerByIdValidation = PlayerResponseValidation.extend({
  birth_date: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  smoker: z.boolean().optional(),
});
export type PlayerById = z.infer<typeof PlayerByIdValidation>;

export async function getPlayerByIdAPI(id: number): Promise<PlayerById> {
  const res = await apiFetch(`/api/players/${id}`);
  if (!res.ok) {
    throw new Error(await responseErrorMessage(res, "Igrač se nije učitao."));
  }
  const json = await res.json();
  return PlayerByIdValidation.parse(json);
}
