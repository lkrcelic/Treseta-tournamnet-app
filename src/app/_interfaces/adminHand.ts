import type {MatchEnd} from "@/app/_lib/game/scoring";
import {z} from "zod";
import {CUSTOM_HAND_MAX, ZvanjaCounts} from "@/app/_lib/game/scoring";
import {TeamSide, TeamSideValidation} from "@/app/_interfaces/side";

// A team's zvanja on a hand: how many worth 3 and how many worth 4 (what the cards allow is checked with the hand)
const ZvanjaCountsValidation = z.object({
  3: z.number().int().min(0).max(7),
  4: z.number().int().min(0).max(3),
});
const NONE: ZvanjaCounts = {3: 0, 4: 0};

// A hand entered by an admin on the Daily scorepad: each team's points, either a normal hand (adding up to 11) or a
// custom one (typed freely, as with the "Custom" key on the players' keypad), each team's zvanja (none on a custom
// hand), and the team that called "s ovim dosta" on it, if any.
export const AdminHandValidation = z.object({
  custom: z.boolean(),
  points1: z.number().int().min(0).max(CUSTOM_HAND_MAX),
  points2: z.number().int().min(0).max(CUSTOM_HAND_MAX),
  zvanja1: ZvanjaCountsValidation.optional().default(NONE),
  zvanja2: ZvanjaCountsValidation.optional().default(NONE),
  dosta: TeamSideValidation.nullable().optional(),
});
export type AdminHand = z.input<typeof AdminHandValidation>;

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
  // each team's total: its points and its zvanja
  total1: number;
  total2: number;
  // what makes the totals up, for opening the hand on the keypad
  points1: number;
  points2: number;
  zvanja1: ZvanjaCounts;
  zvanja2: ZvanjaCounts;
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
  // the league the table is in (0: none, a tournament's table)
  leagueId: number;
  // the tournament a Kolo's table is in; null for a league's table
  tournamentId: number | null;
  // the matches the table plays: 2 in a league, 1 or 2 in a tournament
  matchesPerRound: number;
  // zvanja are entered at the table; false: a tournament's table "bez zvanja"
  declarations: boolean;
  // "s ovim dosta" or "na prolaz" (no "s ovim dosta" question, and Kaput on the keypad)
  matchEnd: MatchEnd;
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
