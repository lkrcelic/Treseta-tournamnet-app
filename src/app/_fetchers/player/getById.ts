import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import { PlayerResponseValidation } from "@/app/_interfaces/player";
import { z } from "zod";
import {PHOTO_VISIBILITIES} from "@/app/_interfaces/photo";

// birth_date (YYYY-MM-DD), phone and smoker are only sent to the player themselves and to admins
const PlayerByIdValidation = PlayerResponseValidation.extend({
  birth_date: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  smoker: z.boolean().optional(),
  // the photo's settings (the player themselves and admins): Moj profil's camera, "Tko vidi sliku"
  photo_url: z.string().nullable().optional(),
  photo_visibility: z.enum(PHOTO_VISIBILITIES).optional(),
  photo_blocked: z.boolean().optional(),
  has_google_photo: z.boolean().optional(),
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
