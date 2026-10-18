import {TeamExtendedResponseValidation} from "@/app/_interfaces/team";
import {z} from "zod";
import {OngoingMatchExtendedResponseValidation} from "./match";
import {SmokingTablesValidation} from "./smoking";

export const RoundResponseValidation = z.object({
  id: z.number().int(),
  tournament_id: z.number().int().optional(),
  league_id: z.number().int().optional(),
  round_number: z.number().int(),
  round_date: z.date(),
  team1_id: z.number().int(),
  team2_id: z.number().int(),
  team1_wins: z.number().int(),
  team2_wins: z.number().int(),
  open: z.boolean(),
  active: z.boolean(),
  table_number: z.number().int().optional(),
  // smoking is allowed at the table
  smoking_table: z.boolean().optional(),
});

export const RoundExtendedResponseValidation = RoundResponseValidation.extend({
  team1: TeamExtendedResponseValidation,
  team2: TeamExtendedResponseValidation,
  ongoingMatches: z.array(OngoingMatchExtendedResponseValidation).optional(),
});

export const RoundCreateRequestValidation = z.object({
  league_id: z.number().int(),
  present_teams: z.array(z.number().int()).min(1),
  numberOfRounds: z.number().int().min(1).max(5).optional(),
  windowSize: z.number().int().min(2).max(200).optional(),
  // create the rounds even though some teams then meet twice today
  allowRepeats: z.boolean().optional(),
  // the tables where smoking is allowed (empty: none); also remembered for the league's next round creation
  smoking_tables: SmokingTablesValidation.optional(),
  // pair every conference on its own, so teams only meet teams of their conference (off by default)
  withinConferences: z.boolean().optional(),
});

// the error code of a round creation that would have some teams meet twice today
export const REPEAT_MATCHUPS = "REPEAT_MATCHUPS";

export type RoundCreateRequest = z.infer<typeof RoundCreateRequestValidation>;

// Upravljanje ligom · Skica: a night's rounds with their tables and status (GET /api/leagues/:id/nights/:date/draft)
export type DraftTable = {
  id: number;
  table: number | null;
  // smoking is allowed at the table
  smoking: boolean;
  team1: {id: number; name: string};
  team2: {id: number; name: string};
};

export type DraftRound = {
  // a round not published yet has a number only to keep its tables together: it is shown as Skica + its letter
  roundNumber: number;
  // "A", "B"… until it is published; null once it is
  letter: string | null;
  status: "DRAFT" | "APPROVED" | "PUBLISHED";
  // ISO time; null until it is published
  publishedAt: string | null;
  // one of its tables: the round's id for PATCH /api/rounds/:id/approve and /unapprove
  id: number;
  tables: DraftTable[];
};

export type DraftNight = {date: string; rounds: DraftRound[]};
export type RoundResponse = z.infer<typeof RoundResponseValidation>;
export type RoundExtendedResponse = z.infer<typeof RoundExtendedResponseValidation>;
