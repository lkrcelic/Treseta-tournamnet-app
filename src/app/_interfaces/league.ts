import {isIsoDate, isStartTime, MAX_NIGHTS, NightLocation} from "@/app/_lib/nights";
import {count, NOUN} from "@/app/_lib/ui/text";
import {z} from "zod";
import {locationIdField} from "@/app/_interfaces/location";
import {CONFERENCE_NAME_MAX, MAX_CONFERENCES} from "@/app/_lib/conferences";
import {GAME_MINUTES_DEFAULT, GAME_MINUTES_ERROR, GAME_MINUTES_MAX, GAME_MINUTES_MIN} from "@/app/_lib/gameTime";

export const DATE_FORMAT_ERROR = "Datum mora biti u obliku GGGG-MM-DD.";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, DATE_FORMAT_ERROR);
const leagueName = z.string().trim().min(1, "Ime lige je obavezno.").max(100, "Ime lige može imati najviše 100 znakova.");
const season = z.string().trim().max(20, "Sezona može imati najviše 20 znakova.");
export const START_TIME_ERROR = "Početak večeri mora biti vrijeme od 00:00 do 23:59.";
// "HH:MM"; null: no time
const startTime = z.string({invalid_type_error: START_TIME_ERROR}).refine(isStartTime, START_TIME_ERROR).nullable();

// A conference as Create League and Manage League send it. The rules for the whole list (none or 2–6, unique names and
// colors from the palette) are checked by the service, which answers with a readable message.
const ConferenceInputValidation = z.object({
  name: z.string().trim().min(1).max(CONFERENCE_NAME_MAX),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
// Where the nights are played (Okupljanje): a place from Lokacije (_interfaces/location.ts), by its id
export {LOCATION_NAME_REQUIRED, LOCATION_URL_ERROR} from "@/app/_interfaces/location";

export const END_DATE_ERROR = "Kraj mora biti nakon početka.";
// Two leagues can't share a name (any case): it is shown on standings and the league pickers
export const LEAGUE_NAME_TAKEN = "Druga liga već ima to ime.";
// Whether another league in the list already has this name (any case); exceptId is the league being renamed. The
// server checks it too (Nova liga, Upravljanje ligom · Podaci).
export function leagueNameTaken(leagues: {id: number; name: string}[], name: string, exceptId?: number): boolean {
  const wanted = name.trim().toLowerCase();
  return wanted !== "" && leagues.some((l) => l.id !== exceptId && l.name.trim().toLowerCase() === wanted);
}
// A league can't have the same night twice
export const NIGHT_TAKEN = "Ta je večer već na popisu.";
export const MAX_NIGHTS_ERROR = `Liga može imati najviše ${count(MAX_NIGHTS, NOUN.večer)}.`;
// ISO dates compare as strings; either date may be missing
export const endsAfterStart = (start?: string | null, end?: string | null) => !start || !end || end > start;

const gameMinutes = z.number().int().min(GAME_MINUTES_MIN, GAME_MINUTES_ERROR).max(GAME_MINUTES_MAX, GAME_MINUTES_ERROR);

export const LeagueCreateRequestValidation = z
  .object({
    league_name: leagueName,
    season: season.optional().nullable(),
    start_date: isoDate.optional().nullable(),
    end_date: isoDate.optional().nullable(),
    // 0 = Monday ... 6 = Sunday
    play_day: z.number().int().min(0).max(6).optional().nullable(),
    // when the nights start (Početak) and start gathering (Okupljanje); both optional
    start_time: startTime.optional(),
    gathering_time: startTime.optional(),
    // where the nights are played, from Lokacije; optional
    location_id: locationIdField.optional(),
    rounds_per_night: z.number().int().min(1).max(6).default(3),
    // Vrijeme partije in minutes
    game_minutes: gameMinutes.default(GAME_MINUTES_DEFAULT),
    team_ids: z.array(z.number().int()).default([]),
    conferences: z.array(ConferenceInputValidation).max(MAX_CONFERENCES).default([]),
    // the league nights; left out, they are filled in from the start date, end date and play day
    nights: z
      .array(z.string().refine(isIsoDate, DATE_FORMAT_ERROR))
      .max(MAX_NIGHTS, MAX_NIGHTS_ERROR)
      .optional(),
  })
  .refine((l) => endsAfterStart(l.start_date, l.end_date), {message: END_DATE_ERROR, path: ["end_date"]});

// Upravljanje ligom · Podaci: any of the league's fields; the ones left out stay as they are
export const LeagueUpdateRequestValidation = z.object({
  league_name: leagueName.optional(),
  season: season.nullable().optional(),
  start_date: isoDate.nullable().optional(),
  end_date: isoDate.nullable().optional(),
  play_day: z.number().int().min(0).max(6).nullable().optional(),
  start_time: startTime.optional(),
  gathering_time: startTime.optional(),
  // the league's place from Lokacije (null: none)
  location_id: locationIdField.optional(),
  rounds_per_night: z.number().int().min(1).max(6).optional(),
  game_minutes: gameMinutes.optional(),
});

export const LeagueNotesRequestValidation = z.object({
  notes: z.string().max(5000, "Bilješke mogu imati najviše 5000 znakova."),
});

// A night's own place from Lokacije; null goes back to the league's, left out stays as it is
const nightLocation = locationIdField.optional();
// A night's second place from Lokacije (Druga lokacija), played at the same time; null: a one-place night, left out
// stays as it is
const secondLocation = locationIdField.optional();

// A second place needs a first one (the night's own or the league's), and can't be that same place
export const SECOND_PLACE_NO_FIRST = "Druga lokacija treba prvu: odaberi mjesto večeri.";
export const SECOND_PLACE_SAME = "Druga lokacija ne može biti isto mjesto kao prva.";
// Why a night can't have these places (null: it can): first is where the night is played (its own place or the
// league's), second its Druga lokacija
export function secondPlaceError(first: number | null | undefined, second: number | null | undefined): string | null {
  if (second == null) return null;
  if (first == null) return SECOND_PLACE_NO_FIRST;
  return first === second ? SECOND_PLACE_SAME : null;
}

// A night's own Broj kola (null: the league's Kola po večeri)
const nightRounds = z.number().int().min(1).max(6).nullable().optional();

// Upravljanje ligom · Datumi (Dodaj večer): add a night, with its own Početak, Okupljanje, Broj kola and place or (left
// out or null) the league's, and a second place or none
export const LeagueNightAddRequestValidation = z.object({
  date: z.string().refine(isIsoDate, DATE_FORMAT_ERROR),
  start_time: startTime.optional(),
  gathering_time: startTime.optional(),
  rounds_per_night: nightRounds,
  location_id: nightLocation,
  second_location_id: secondLocation,
});

// Upravljanje ligom · Datumi (Uredi večer): a night's date, its own Početak, Okupljanje, Broj kola and place, and its
// second place. Any can be left out (it stays as it is); null goes back to the league's (a null second place: one place).
export const LeagueNightUpdateRequestValidation = z
  .object({
    date: z.string().refine(isIsoDate, DATE_FORMAT_ERROR).optional(),
    start_time: startTime.optional(),
    gathering_time: startTime.optional(),
    rounds_per_night: nightRounds,
    location_id: nightLocation,
    second_location_id: secondLocation,
  })
  .refine(
    (b) =>
      b.date !== undefined ||
      b.start_time !== undefined ||
      b.gathering_time !== undefined ||
      b.rounds_per_night !== undefined ||
      b.location_id !== undefined ||
      b.second_location_id !== undefined,
    "Nema promjene."
  );

export type LeagueNightUpdate = z.infer<typeof LeagueNightUpdateRequestValidation>;
export type LeagueNightAdd = z.infer<typeof LeagueNightAddRequestValidation>;

// The date, start time and place of a night that has rounds or has passed don't change
export const PAST_NIGHT_ERROR = "Datum, vrijeme i mjesto mijenjaju se samo večerima koje još nisu odigrane.";
// A night moves only to today or later: one moved into the past couldn't be changed any more
export const MOVE_TO_PAST_ERROR = "Večer se može premjestiti samo na današnji ili kasniji datum.";

// A league night and its published rounds (played: it has some). start_time: its own Početak (null: the league's);
// time: when it starts, its own or the league's (null: no time). gathering_time and gathering: the same for
// Okupljanje. rounds_per_night: its own Broj kola (null: the league's); planned_rounds: how many rounds it plays, its own
// or the league's. location: its own place (null: the league's); place: where it is played, its own or the league's
// (null: nowhere set). second_location: its Druga lokacija, played at the same time (null: a one-place night).
export type LeagueNightRow = {
  date: string;
  played: boolean;
  rounds: number;
  start_time: string | null;
  time: string | null;
  gathering_time: string | null;
  gathering: string | null;
  rounds_per_night: number | null;
  planned_rounds: number;
  location: NightLocation | null;
  place: NightLocation | null;
  second_location: NightLocation | null;
};

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
  start_time: string | null; // "HH:MM", when the nights start (Početak) unless a night has its own
  gathering_time: string | null; // "HH:MM", when the nights start gathering (Okupljanje) unless a night has its own
  // where the nights are played unless a night has its own place (null: no place), from Lokacije
  location: NightLocation | null;
  rounds_per_night: number;
  // Vrijeme partije: a match's time limit in minutes
  game_minutes: number;
  // the smoking tables of its last Create Round (empty: none)
  smoking_tables: number[];
  team_count: number;
  last_played: string | null; // the latest round night, YYYY-MM-DD
  last_night: string | null; // the league's last scheduled night (Datumi), YYYY-MM-DD; with end_date it says whether the league is over (leagueEnded)
  active: boolean; // the league being played now (see pickActiveLeague)
};

// A team of a league with its players, for Manage League and Create Round
export type LeagueTeamDetails = {
  team_id: number;
  team_name: string;
  active: boolean;
  conference_id: number | null;
  players: {id: number; username: string}[];
  // players on the team who smoke
  smokers: number;
};

// A league's conferences in order, and which team is in which (public, like the standings)
export type LeagueConferences = {
  conferences: {conference_id: number; name: string; color: string}[];
  // the teams that have a conference
  teams: {team_id: number; conference_id: number}[];
};
