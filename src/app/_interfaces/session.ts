import {z} from "zod";
import {PlayerResponseValidation} from "./player";

export const LuciaSessionOut = z.object({
  id: z.string(),
  expiresAt: z.date(),
  userId: z.number(),
  player: PlayerResponseValidation

});

export const GoogleSessionOut = z.object({
  id: z.string(),
  expires: z.date(),
  sessionToken: z.string(),
  userId: z.number(),
  user: PlayerResponseValidation
});

export const LuciaSessionsOut = z.array(LuciaSessionOut);
export const GoogleSessionsOut = z.array(GoogleSessionOut);