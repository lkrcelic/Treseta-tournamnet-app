// The player ratings page (Glicko-2, see _lib/rating/glicko2.ts)

export type RatingRow = {
  id: number;
  rank: number; // players with the same rating share a rank
  name: string;
  username: string;
  team: string | null; // the team they played for most recently
  rating: number;
  change: number | null; // at the last night they played; null before their first
  rounds: number; // rated rounds played
  provisional: boolean; // fewer than PROVISIONAL_ROUNDS rated rounds
};

export type RatingsList = {
  players: RatingRow[];
  me: number | null; // the viewer's id
};

export type RatingNight = {
  night: string; // YYYY-MM-DD
  opponents: string[]; // the teams they played that night, in order
  won: number; // matches won that night
  lost: number;
  change: number;
};

export type PlayerRatingDetail = {
  player: RatingRow;
  total: number; // players on the list ("#7 od 25")
  history: {night: string; rating: number}[]; // oldest first
  lastNights: RatingNight[]; // newest first, at most 5
};
