import {z} from "zod";
import {CUSTOM_HAND_MAX} from "@/app/_lib/game/scoring";
import {TeamSide, TeamSideValidation} from "@/app/_interfaces/side";

// A hand entered by an admin on the Daily scorepad: each team's points, either a normal hand (adding up to 11) or a
// custom one (typed freely, as with the "Custom" key on the players' keypad), and the team that called
// "s ovim dosta" on it, if any.
export const AdminHandValidation = z.object({
  custom: z.boolean(),
  points1: z.number().int().min(0).max(CUSTOM_HAND_MAX),
  points2: z.number().int().min(0).max(CUSTOM_HAND_MAX),
  dosta: TeamSideValidation.nullable().optional(),
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
  dosta: TeamSide | null;
};

export type PadMatch = {
  kind: HandKind;
  id: number;
  number: number;
  score1: number;
  score2: number;
  // the points to reach: 41, raised by a tie
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
  // smoking is allowed at the table
  smoking: boolean;
  team1: {id: number; name: string};
  team2: {id: number; name: string};
  // the round is finished (both matches played, or settled by hand)
  done: boolean;
  bye: boolean;
  // who plays is confirmed (an open table without a lineup goes through the lineup screen first)
  hasLineup: boolean;
  matches: PadMatch[];
};

// A table as anyone signed in may see it (Pregled stola): the matches with each hand's totals only
export type OverviewMatch = Omit<PadMatch, "hands"> & {hands: {id: number; total1: number; total2: number}[]};
export type TableOverview = Omit<TablePad, "hasLineup" | "matches"> & {matches: OverviewMatch[]};
