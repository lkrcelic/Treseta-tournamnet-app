import {TeamExtendedResponseValidation} from "@/app/_interfaces/team";
import {z} from "zod";
import {OngoingMatchExtendedResponseValidation} from "./match";

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
  // create the rounds even though some tables have two teams of the same conference
  allowSameConference: z.boolean().optional(),
});

// the error code of a round creation that needs the admin's go-ahead: some teams would meet twice today (repeats),
// or some tables would have two teams of the same conference (same_conference)
export const PAIRING_NOTICE = "PAIRING_NOTICE";

// a table of the new rounds whose two teams are in the same conference, as the notice lists it
export type SameConferencePair = {teams: [string, string]; conference: {name: string; color: string}};

export type RoundCreateRequest = z.infer<typeof RoundCreateRequestValidation>;
export type RoundResponse = z.infer<typeof RoundResponseValidation>;
export type RoundExtendedResponse = z.infer<typeof RoundExtendedResponseValidation>;
