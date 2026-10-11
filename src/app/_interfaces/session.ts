import {z} from "zod";
import {PlayerResponseValidation} from "./player";

// Session ids/tokens are left out on purpose: whoever has one is logged in as that player.
export const LuciaSessionOut = z.object({
  expiresAt: z.date(),
  userId: z.number(),
  player: PlayerResponseValidation

});

export const GoogleSessionOut = z.object({
  expires: z.date(),
  userId: z.number(),
  user: PlayerResponseValidation
});

export const LuciaSessionsOut = z.array(LuciaSessionOut);
export const GoogleSessionsOut = z.array(GoogleSessionOut);