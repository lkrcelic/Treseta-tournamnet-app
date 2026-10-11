import {z} from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.");

export const END_DATE_ERROR = "End date must be after the start date.";
// ISO dates compare as strings; either date may be missing
export const endsAfterStart = (start?: string | null, end?: string | null) => !start || !end || end > start;

export const LeagueCreateRequestValidation = z
  .object({
    league_name: z.string().trim().min(1).max(100),
    season: z.string().trim().max(20).optional().nullable(),
    start_date: isoDate.optional().nullable(),
    end_date: isoDate.optional().nullable(),
    // 0 = Monday ... 6 = Sunday
    play_day: z.number().int().min(0).max(6).optional().nullable(),
    rounds_per_night: z.number().int().min(1).max(6).default(3),
    team_ids: z.array(z.number().int()).default([]),
  })
  .refine((l) => endsAfterStart(l.start_date, l.end_date), {message: END_DATE_ERROR, path: ["end_date"]});

// Manage League · Details: any of the league's fields; the ones left out stay as they are
export const LeagueUpdateRequestValidation = z.object({
  league_name: z.string().trim().min(1, "League name is required.").max(100).optional(),
  season: z.string().trim().max(20).nullable().optional(),
  start_date: isoDate.nullable().optional(),
  end_date: isoDate.nullable().optional(),
  play_day: z.number().int().min(0).max(6).nullable().optional(),
  rounds_per_night: z.number().int().min(1).max(6).optional(),
});

export const LeagueNotesRequestValidation = z.object({
  notes: z.string().max(5000, "Notes can be at most 5000 characters."),
});

export const LeagueTeamAddRequestValidation = z.object({
  team_id: z.number().int(),
});

export const LeagueTeamUpdateRequestValidation = z.object({
  active: z.boolean(),
});

export type LeagueCreateRequest = z.infer<typeof LeagueCreateRequestValidation>;
export type LeagueUpdateRequest = z.infer<typeof LeagueUpdateRequestValidation>;

// A league as the pickers and Create Round see it
export type LeagueSummary = {
  league_id: number;
  league_name: string;
  season: string | null;
  start_date: string | null;
  end_date: string | null;
  play_day: number | null;
  rounds_per_night: number;
  team_count: number;
  last_played: string | null; // the latest round night, YYYY-MM-DD
  active: boolean; // the league being played now (see pickActiveLeague)
};

// A team of a league with its players, for Manage League and Create Round
export type LeagueTeamDetails = {
  team_id: number;
  team_name: string;
  active: boolean;
  players: {id: number; username: string}[];
};
