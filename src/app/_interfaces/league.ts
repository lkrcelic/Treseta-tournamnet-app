import {isIsoDate, MAX_NIGHTS} from "@/app/_lib/nights";
import {z} from "zod";
import {CONFERENCE_NAME_MAX, MAX_CONFERENCES} from "@/app/_lib/conferences";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format.");

// A conference as Create League and Manage League send it. The rules for the whole list (none or 2–6, unique names and
// colors from the palette) are checked by the service, which answers with a readable message.
const ConferenceInputValidation = z.object({
  name: z.string().trim().min(1).max(CONFERENCE_NAME_MAX),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

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
    conferences: z.array(ConferenceInputValidation).max(MAX_CONFERENCES).default([]),
    // the league nights; left out, they are filled in from the start date, end date and play day
    nights: z
      .array(z.string().refine(isIsoDate, "Use the YYYY-MM-DD format."))
      .max(MAX_NIGHTS, `A league can have at most ${MAX_NIGHTS} nights.`)
      .optional(),
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

// Manage League · Dates: add a night
export const LeagueNightAddRequestValidation = z.object({
  date: z.string().refine(isIsoDate, "Use the YYYY-MM-DD format."),
});

// A league night and whether it has rounds (a played night can't be removed)
export type LeagueNightRow = {date: string; played: boolean};

export const LeagueTeamAddRequestValidation = z.object({
  team_id: z.number().int(),
});

// A team's active flag and/or its conference (null: none)
export const LeagueTeamUpdateRequestValidation = z
  .object({
    active: z.boolean().optional(),
    conference_id: z.number().int().nullable().optional(),
  })
  .refine((t) => t.active !== undefined || t.conference_id !== undefined, {message: "Pošalji active ili conference_id."});

// Manage League · Details: the league's whole list of conferences, in order. A conference with an id is kept (renamed
// or recolored), one without is new, and the league's conferences left out are deleted (their teams lose them).
export const LeagueConferencesRequestValidation = z.object({
  conferences: z.array(ConferenceInputValidation.extend({conference_id: z.number().int().optional()})).max(MAX_CONFERENCES),
});

// Manage League · "Distribute evenly": several teams' conferences at once (null: none)
export const LeagueTeamConferencesRequestValidation = z.object({
  teams: z.array(z.object({team_id: z.number().int(), conference_id: z.number().int().nullable()})).max(1000),
});

export type LeagueCreateRequest = z.infer<typeof LeagueCreateRequestValidation>;
export type LeagueUpdateRequest = z.infer<typeof LeagueUpdateRequestValidation>;
export type LeagueConferencesRequest = z.infer<typeof LeagueConferencesRequestValidation>;
export type LeagueTeamConferencesRequest = z.infer<typeof LeagueTeamConferencesRequestValidation>;

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
  conference_id: number | null;
  players: {id: number; username: string}[];
};

// A league's conferences in order, and which team is in which (public, like the standings)
export type LeagueConferences = {
  conferences: {conference_id: number; name: string; color: string}[];
  // the teams that have a conference
  teams: {team_id: number; conference_id: number}[];
};
