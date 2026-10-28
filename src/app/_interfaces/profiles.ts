// The Team and Player pages (handoff §6): what GET /api/teams/[id]/overview and GET /api/players/[id]/overview send.
// Rating, teams, leagues and results are public to every logged-in player; personal data is filtered on the server
// (_lib/players/privacy.ts).
import type {PlayerView} from "@/app/_interfaces/player";
import type {RatingNight} from "@/app/_interfaces/ratings";
import type {OwnPhoto, TeamPhotoInfo} from "@/app/_interfaces/photo";

// ---------- Team page ----------

// One player of the team (Igrači), highest rating first. Deleted players are never on a team.
export type TeamOverviewPlayer = {
  id: number;
  // the full name, or "Igrač bez imena"
  name: string;
  first_name: string;
  last_name: string;
  // only for an admin and the player themself, null for everyone else (the second line then shows the team name)
  username: string | null;
  // as on Rejting
  rating: number;
  rounds: number;
  provisional: boolean;
  // false = deactivated ("Neaktivan" is shown to everyone)
  active: boolean;
  // the viewer's own row
  me: boolean;
  // the avatar; null = the initials (no photo, or the viewer may not see it)
  photo_url: string | null;
};

// One league the team plays in (Lige): live ones first, then the newest
export type TeamOverviewLeague = {
  league_id: number;
  league_name: string;
  season: string | null;
  // "U tijeku"; false = "Završeno" (leagueEnded in _lib/league.ts)
  live: boolean;
  // the team's place and points in that league's Ukupni poredak; null before it has finished a round there
  rank: number | null;
  points: number | null;
  // rounds finished in that league
  played: number;
};

// One night the team played in a league (Zadnje večeri): the rounds won, drawn and lost, and the point difference
export type TeamNight = {
  date: string; // YYYY-MM-DD
  league_id: number;
  league_name: string;
  wins: number;
  draws: number;
  losses: number;
  diff: number;
};

export type TeamOverview = {
  // mine: the viewer is in the team ("Tvoja ekipa")
  team: {id: number; name: string; mine: boolean};
  // the team's photo (url null = its letter); visibility and the block go to its players and admins only
  photo: TeamPhotoInfo | {photo_url: string | null};
  stats: {
    // Najbolje mjesto: the best final place over the team's leagues that are over (null = "–")
    best: {rank: number; league_id: number; league_name: string} | null;
    players: number;
    leagues: number;
    // "K u tijeku"
    leagues_live: number;
  };
  players: TeamOverviewPlayer[];
  leagues: TeamOverviewLeague[];
  // at most 4, newest first
  nights: TeamNight[];
  viewer: {admin: boolean};
};

// ---------- Player page ----------

// The rating summary as Rejting shows it. A player who isn't on Rejting (never on a team, no rated round) has their
// stored rating, no change, no rounds, Privremeno and no place.
export type PlayerRatingSummary = {
  rating: number;
  change: number | null;
  rounds: number;
  provisional: boolean;
  rank: number | null;
  // players on Rejting ("#1 od 25")
  total: number;
};

// One team of the player (Ekipe), in Croatian name order
export type PlayerOverviewTeam = {
  team_id: number;
  team_name: string;
  // newest first
  leagues: {league_id: number; league_name: string}[];
  // every player of the team (the player too) in the team's rating order, as the Team page lists them (frame 13c);
  // the chips show the first name and the initials of the full name
  players: {id: number; first_name: string; last_name: string; photo_url: string | null}[];
  // the team's avatar
  photo_url: string | null;
};

export type PlayerOverview = {
  // privacy-filtered: the personal keys are absent unless full
  player: PlayerView;
  // the player's photo (url null = the initials); its settings only with full (the player themself, an admin: the
  // admin's Profilna slika block)
  photo: OwnPhoto | {photo_url: string | null};
  // the viewer is the player or an admin, so the page shows every personal field
  full: boolean;
  // rank null = not on Rejting, so /ratings/<id> is "Igrač ne postoji": show the rating without the link to it
  rating: PlayerRatingSummary;
  teams: PlayerOverviewTeam[];
  // at most 5, newest first
  nights: RatingNight[];
  viewer: {admin: boolean; self: boolean};
};
