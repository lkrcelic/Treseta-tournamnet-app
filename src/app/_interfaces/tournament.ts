import {z} from "zod";
import {isIsoDate, isSafeUrl, isStartTime} from "@/app/_lib/nights";
import {DATE_FORMAT_ERROR, LOCATION_URL_ERROR} from "@/app/_interfaces/league";
import type {TournamentPhase} from "@/app/_lib/tournaments";
import type {ArrivalPhase} from "@/app/_lib/tournamentDay";
import type {TableState} from "@/app/_lib/tableState";
import type {StandingsItem} from "@/app/_lib/ui/standings";
import {GAME_MINUTES_ERROR, GAME_MINUTES_MAX, GAME_MINUTES_MIN} from "@/app/_lib/gameTime";
import {isValidPhone, PHONE_ERROR} from "@/app/_lib/phone";

// Turniri: what the admin sends to create or change a tournament, what a player sends to sign a team up, and what the
// tournament API answers with.

export const TOURNAMENT_NAME_REQUIRED = "Upiši naziv turnira.";
export const TOURNAMENT_DATE_REQUIRED = "Odaberi datum turnira.";
export const TIME_ERROR = "Vrijeme mora biti od 00:00 do 23:59.";
export const MAX_TEAMS_ERROR = "Najmanje dvije ekipe, ili ostavi prazno.";
export const ROUNDS_ERROR = "Turnir ima od 1 do 20 kola.";
export const FEE_ERROR = "Kotizacija je od 0 do 999 €.";

const time = z.string({invalid_type_error: TIME_ERROR}).refine(isStartTime, TIME_ERROR).nullable();
const text = (max: number, message: string) => z.string().trim().max(max, message).nullable();
const url = z
  .string()
  .trim()
  .max(500, "Link može imati najviše 500 znakova.")
  .refine((v) => v === "" || isSafeUrl(v), LOCATION_URL_ERROR)
  .nullable();

const PrizeValidation = z.object({
  prize: z.string().trim().min(1, "Upiši nagradu za svako mjesto ili makni redak.").max(100, "Nagrada može imati najviše 100 znakova."),
  description: z.string().trim().max(200, "Opis nagrade može imati najviše 200 znakova.").default(""),
});

// Novi turnir and Podaci send the whole form; an empty text field is null
export const TournamentRequestValidation = z.object({
  name: z.string({required_error: TOURNAMENT_NAME_REQUIRED}).trim().min(1, TOURNAMENT_NAME_REQUIRED).max(100, "Naziv turnira može imati najviše 100 znakova."),
  date: z.string({required_error: TOURNAMENT_DATE_REQUIRED}).refine(isIsoDate, DATE_FORMAT_ERROR),
  gathering_time: time,
  start_time: time,
  location_name: text(100, "Ime mjesta može imati najviše 100 znakova."),
  location_address: text(200, "Adresa može imati najviše 200 znakova."),
  location_url: url,
  rounds: z.number().int().min(1, ROUNDS_ERROR).max(20, ROUNDS_ERROR),
  matches_per_round: z.union([z.literal(1), z.literal(2)]),
  max_teams: z.number().int().min(2, MAX_TEAMS_ERROR).max(500, "Najviše 500 ekipa.").nullable(),
  entry_fee: z.number().int().min(0, FEE_ERROR).max(999, FEE_ERROR),
  rules_url: url,
  prizes: z.array(PrizeValidation).max(20, "Najviše 20 nagrada."),
  // Vrijeme partije in minutes
  game_minutes: z.number().int().min(GAME_MINUTES_MIN, GAME_MINUTES_ERROR).max(GAME_MINUTES_MAX, GAME_MINUTES_ERROR).default(35),
  // Automatska kola: the Kolos after the first are published by themselves
  auto_publish: z.boolean().default(false),
  // Otvorene prijave: ekipe se mogu prijaviti i dok turnir traje, do zadnjeg kola (DECISIONS #88)
  open_signups: z.boolean().default(false),
  // Telefon organizatora: required for a new tournament (checked by the service); an old one may stay without
  organizer_phone: z.string().trim().max(30).refine((v) => v === "" || isValidPhone(v), PHONE_ERROR).nullable().default(null),
});

// written out by hand: with strict off, z.infer would make every field optional
export type TournamentRequest = {
  name: string;
  date: string;
  gathering_time: string | null;
  start_time: string | null;
  location_name: string | null;
  location_address: string | null;
  location_url: string | null;
  rounds: number;
  matches_per_round: 1 | 2;
  max_teams: number | null;
  entry_fee: number;
  rules_url: string | null;
  prizes: {prize: string; description: string}[];
  game_minutes: number;
  auto_publish: boolean;
  open_signups: boolean;
  organizer_phone: string | null;
};

export const ORGANIZER_PHONE_REQUIRED = "Upiši telefon organizatora. Igrači ga zovu ako kasne.";

const teamName = z.string().trim().min(1, "Upiši ime ekipe.").max(100, "Ime ekipe je predugo.");

// Prijavi ekipu: one of the player's teams, or a new team of the player and a partner (Kreiraj ekipu i prijavi)
export const RegistrationRequestValidation = z.union([
  z.object({team_id: z.number().int()}),
  z.object({new_team: z.object({name: teamName, partner_id: z.number().int()})}),
]);
export type RegistrationRequest = {team_id: number} | {new_team: {name: string; partner_id: number}};

export const TeamIdValidation = z.object({team_id: z.number().int()});
export const RegistrationsOpenValidation = z.object({open: z.boolean()});
export const KoloRequestValidation = z.object({redo: z.boolean().optional()});
export const KoloTableValidation = z.object({team1_id: z.number().int(), team2_id: z.number().int()});

// ---------- answers ----------

export type TournamentPlace = {name: string | null; address: string | null; url: string | null};

// A player as a tournament's lists show them (the username only for an admin: they are private)
// username: public (#88), so every viewer gets it
export type EntryPlayer = {id: number; name: string; photo_url: string | null; username: string};

// Potvrda dolaska: when and by whom ("Potvrdio Marko u 9:43"; by is null for the admin's Označi dolazak)
export type EntryArrival = {at: string; by: string | null; admin: boolean};

// Out of the rest of the tournament after a Kolo (Isključena · nedolazak K3)
export type EntryExclusion = {at: string; kolo: number | null; reason: "NO_SHOW" | "SKIPPED" | "ADMIN"};

// A team's entry (Prijavljene ekipe, Prijave, Lista čekanja)
export type TournamentEntryView = {
  team_id: number;
  team_name: string;
  photo_url: string | null;
  players: EntryPlayer[];
  // the average rating of its players (for a logged-in viewer); null without players or for a visitor
  rating: number | null;
  status: "REGISTERED" | "WAITING";
  // ISO time it signed up (Prijavljeno)
  registered_at: string;
  // its place on the waiting list (1 = next in); null when it is in
  position: number | null;
  // the viewer plays in it
  mine: boolean;
  arrival: EntryArrival | null;
  // Aktivna: plays the next Kolo
  active: boolean;
  excluded: EntryExclusion | null;
  // its ban on sign-ups in force (admin only), for the Zabrana tag
  ban_until?: string | null;
  banned?: boolean;
};

// The viewer's own entry
export type MyEntry = {
  team_id: number;
  team_name: string;
  status: "REGISTERED" | "WAITING";
  position: number | null;
  players: EntryPlayer[];
  arrival: EntryArrival | null;
  active: boolean;
  excluded: EntryExclusion | null;
  // the Kolo it plays from after joining (Igrate od Kola 3); null when it plays the next one anyway
  plays_from: number | null;
};

// Potvrda dolaska's window on the tournament's day; null for a tournament without a start time
export type TournamentDay = {opens: string; closes: string; phase: ArrivalPhase};

export type TournamentWinner = {team_id: number; team_name: string; photo_url: string | null; players: string[]; wins: number; draws: number; losses: number};

// A tournament card (Početna · Turniri, Nadolazeći turniri, Završeni turniri) and the head of its page
export type TournamentCard = {
  id: number;
  name: string;
  date: string;
  gathering_time: string | null;
  start_time: string | null;
  location: TournamentPlace;
  rounds: number;
  matches_per_round: number;
  entry_fee: number;
  max_teams: number | null;
  registrations_open: boolean;
  phase: TournamentPhase;
  // teams in, waiting, and the players of the teams in
  teams: number;
  waiting: number;
  players: number;
  // a few players of the teams in, for the bubbles beside the count
  avatars: {name: string; photo_url: string | null}[];
  completed_kolos: number;
  live_kolo: number | null;
  winner: TournamentWinner | null;
  me: MyEntry | null;
  // the viewer's team's final place once it is over (N1's #5)
  my_place: number | null;
  // Vrijeme partije in minutes
  game_minutes: number;
  // Automatska kola: the Kolos after the first are published by themselves
  auto_publish: boolean;
  // Otvorene prijave: teams sign up while the tournament is played, up to its last Kolo (DECISIONS #88)
  open_signups: boolean;
  // whether a team can sign up at this very moment (the switch, the phase and the last Kolo together)
  signups_open_now: boolean;
  day: TournamentDay | null;
  // the last Kolo is made (draft or published): a team can't join any more (no Tu smo · Želimo uskočiti)
  last_kolo_made: boolean;
  // the server's clock (ISO), for the countdowns
  server_now: string;
  // whether the viewer runs this tournament: an admin any, an organizer the one they made (DECISIONS #86). Every
  // Upravljanje button asks this, not the admin role.
  can_manage: boolean;
  // Otkazan: who cancelled it and when (admins only)
  cancelled_info?: {by: string | null; at: string} | null;
};

export type TournamentPrizeView = {place: number; prize: string; description: string};

// One of the viewer's teams in the sign-up sheet (Koju ekipu prijavljuješ?), and why it can't sign up if it can't
export type MyTeamOption = {
  team_id: number;
  team_name: string;
  photo_url: string | null;
  players: {id: number; name: string; photo_url: string | null; me: boolean}[];
  // already signed up (in or waiting)
  entry: "REGISTERED" | "WAITING" | null;
  reason: string | null;
  // the team (or one of its players) may not sign up until this day; "" = Trajno; null = no ban
  ban_until: string | null;
};

// A table of the viewer's team (Vaši mečevi): the opponent and the matches won, the viewer's team first
export type MyMatch = {kolo: number; round_id: number; opponent: string; opponent_id: number; wins: [number, number]; done: boolean; bye: boolean};

// The viewer's tournament once it is over (Vaš rezultat)
export type MyResult = {
  place: number;
  of: number;
  team_id: number;
  team_name: string;
  // who of the team played its tables
  players: string[];
  wins: number;
  draws: number;
  losses: number;
  // the viewer's rating before and after the tournament (its date is one rating period); null without one
  rating: {before: number; after: number; change: number} | null;
};

export type TournamentDetail = TournamentCard & {
  rules_url: string | null;
  prizes: TournamentPrizeView[];
  // the teams in, the viewer's first, then by rating
  entries: TournamentEntryView[];
  // the viewer's teams for the sign-up sheet (logged in, while sign-ups are open)
  my_teams: MyTeamOption[];
  my_matches: MyMatch[];
  my_result: MyResult | null;
  cancelled: boolean;
  // Telefon organizatora (logged-in viewers): Nazovi · WhatsApp
  organizer_phone: string | null;
  // the viewer's own ban on sign-ups ("" = Trajno); null without one
  my_ban: {until: string | null} | null;
  // the viewer's team's table that was decided without play (Pobjeda bez igre, Isključeni ste) in the last Kolo
  my_last_table: MyLastTable | null;
};

// How the viewer's team's latest table ended when it wasn't played (Nedolazak za stol)
export type MyLastTable = {
  round_id: number;
  kolo: number;
  table_number: number | null;
  attendance: "NO_SHOW" | "SKIPPED";
  // NO_SHOW: the viewer's team won (it answered) or didn't come
  won: boolean;
  opponent: string;
  // when the answer came (ISO), and the score of each match (the viewer's team first)
  at: string;
  matches: [number, number][];
};

// A table of a Kolo, in the shape of the league's rounds so the league's table rows read it (toTableRows)
export type KoloTable = {
  id: number;
  table_number: number | null;
  smoking_table: boolean;
  team1_id: number;
  team2_id: number;
  team1: {team_name: string; photo_url: string | null};
  team2: {team_name: string; photo_url: string | null};
  team1_wins: number;
  team2_wins: number;
  active: boolean;
  open: boolean;
  ongoingMatches: {player_pair1_score: number; player_pair2_score: number}[];
  // its matches played (the table rows' point difference once it's done, as the league's)
  matches: {player_pair1_score: number; player_pair2_score: number}[];
  status: "DRAFT" | "APPROVED" | "PUBLISHED";
  // the admin's status of the table (Upit · 1:52, Nedolazak, Vrijeme isteklo, Preskočen…) and its line of explanation
  state?: TableState;
};

export type KoloView = {number: number; published: boolean; tables: KoloTable[]};

// A standings row: the league's shape (StandingsRows / StandingsGrid read it) with the team's players; an excluded team
// stays with its Kolos played (Isključena nakon Kola 3 · nedolazak)
export type TournamentStandingsItem = StandingsItem & {team_id: number; players: string[]; excluded?: EntryExclusion | null};

// Poredak i rezultati: the standings and every Kolo (players: the published ones; the admin also the draft)
export type TournamentResults = {
  id: number;
  name: string;
  date: string;
  rounds: number;
  matches_per_round: number;
  phase: TournamentPhase;
  completed_kolos: number;
  live_kolo: number | null;
  standings: TournamentStandingsItem[];
  kolos: KoloView[];
  // the viewer's team, for the highlighted row and "my table first"
  my_team_id: number | null;
};

// ---------- admin ----------

export type AdminTournamentRow = TournamentCard & {
  created_at: string;
};

export type CandidateTeam = {team_id: number; team_name: string; players: EntryPlayer[]; reason: string | null; ban_until?: string | null; banned?: boolean};

// Upravljanje turnirom: the tournament's fields, its entries, its Kolos and the standings
export type AdminTournament = TournamentCard & {
  rules_url: string | null;
  prizes: TournamentPrizeView[];
  started_at: string | null;
  cancelled_at: string | null;
  entries: TournamentEntryView[];
  waiting_list: TournamentEntryView[];
  results: TournamentResults;
  // the next Kolo that can be made (Složi Kolo N), and why not yet; null when every Kolo is out
  next_kolo: {number: number; ready: boolean; reason: string | null} | null;
  // the waiting draft (of any Kolo) seats other teams than the ones that play now: it has to be made again before it is published
  stale_draft: boolean;
  organizer_phone: string | null;
  // who pressed Otkaži
  cancelled_by: string | null;
  // the day's numbers (Prijave on the tournament's day) and what the start time will do (U 10:00)
  arrival_summary: ArrivalSummary | null;
};

export type ArrivalSummary = {
  here: number;
  not_confirmed: number;
  waiting_here: number;
  waiting: number;
  // at the start time: these become inactive, these come in from the waiting list
  will_be_inactive: string[];
  will_come_in: string[];
  active: number;
  excluded: number;
};
