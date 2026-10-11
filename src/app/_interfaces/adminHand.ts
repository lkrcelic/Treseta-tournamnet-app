import {z} from "zod";
import {CUSTOM_HAND_MAX} from "@/app/_lib/game/scoring";

// A hand entered by an admin on the Daily scorepad: each team's points, either a normal hand (adding up to 11) or a
// custom one (typed freely, as with the "Custom" key on the players' keypad).
export const AdminHandValidation = z.object({
  custom: z.boolean(),
  points1: z.number().int().min(0).max(CUSTOM_HAND_MAX),
  points2: z.number().int().min(0).max(CUSTOM_HAND_MAX),
});
export type AdminHand = z.infer<typeof AdminHandValidation>;

export const AdminHandTargetValidation = z.discriminatedUnion("kind", [
  // the match being played at the table (started when the table hasn't started yet)
  z.object({kind: z.literal("ongoing")}),
  // a finished match of the table
  z.object({kind: z.literal("finished"), matchId: z.number().int()}),
]);

export const AdminHandCreateValidation = z.object({target: AdminHandTargetValidation, hand: AdminHandValidation});

export const HandKindValidation = z.enum(["ongoing", "finished"]);
export type HandKind = z.infer<typeof HandKindValidation>;

export type PadHand = {
  id: number;
  total1: number;
  total2: number;
  custom: boolean;
};

export type PadMatch = {
  kind: HandKind;
  id: number;
  number: number;
  score1: number;
  score2: number;
  threshold: number;
  winner: 1 | 2 | null;
  hands: PadHand[];
};

export type TablePad = {
  roundId: number;
  leagueId: number;
  roundNumber: number | null;
  date: string | null;
  table: number | null;
  team1: {id: number; name: string};
  team2: {id: number; name: string};
  // the round is finished (both matches played, or settled by hand)
  done: boolean;
  bye: boolean;
  // who plays is confirmed (an open table without a lineup goes through the lineup screen first)
  hasLineup: boolean;
  matches: PadMatch[];
};
