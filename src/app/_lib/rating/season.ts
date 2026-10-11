import {Game, initialRating, PlayerRating, ratePeriod} from "./glicko2";

// The whole rating history from the rated rounds: one Glicko-2 period per league night, every match a game.
// Framework free; the replay (service/admin/recalc.ts) loads the rounds and writes the result.

export type RatedRound = {
  night: string; // YYYY-MM-DD
  teamA: number[]; // the players rated for team1
  teamB: number[];
  // each match's points, team1 first; a round without stored matches falls back to its wins
  matches: [number, number][];
  wins: [number, number];
};

export type NightRating = {playerId: number; night: string; rating: number; rd: number; change: number; rounds: number};

export type SeasonRatings = {ratings: Map<number, PlayerRating>; history: NightRating[]};

// The games of a round: a win, loss or draw per match
export function roundGames(r: RatedRound): Game[] {
  const game = (scoreA: number): Game => ({teamA: r.teamA, teamB: r.teamB, scoreA});
  if (r.matches.length > 0) return r.matches.map(([a, b]) => game(a > b ? 1 : a < b ? 0 : 0.5));
  return [...Array(r.wins[0]).fill(1), ...Array(r.wins[1]).fill(0)].map(game);
}

/**
 * Every player starts at the defaults; the nights are rated in date order. Returns everyone's rating after the
 * last night, and one history row per player for each night they played.
 */
export function replaySeason(playerIds: number[], rounds: RatedRound[]): SeasonRatings {
  let ratings = new Map<number, PlayerRating>(playerIds.map((id) => [id, initialRating()]));
  const known = new Set(playerIds);
  const history: NightRating[] = [];

  const nights = new Map<string, RatedRound[]>();
  for (const r of rounds) {
    const teamA = r.teamA.filter((id) => known.has(id));
    const teamB = r.teamB.filter((id) => known.has(id));
    if (teamA.length === 0 || teamB.length === 0) continue;
    nights.set(r.night, [...(nights.get(r.night) ?? []), {...r, teamA, teamB}]);
  }

  for (const night of Array.from(nights.keys()).sort()) {
    const nightRounds = nights.get(night)!;
    const after = ratePeriod(ratings, nightRounds.flatMap(roundGames));
    const roundsPlayed = new Map<number, number>();
    for (const r of nightRounds) for (const id of [...r.teamA, ...r.teamB]) roundsPlayed.set(id, (roundsPlayed.get(id) ?? 0) + 1);
    roundsPlayed.forEach((count, playerId) => {
      const now = after.get(playerId)!;
      const was = ratings.get(playerId)!;
      history.push({
        playerId,
        night,
        rating: Math.round(now.rating),
        rd: now.rd,
        change: Math.round(now.rating) - Math.round(was.rating),
        rounds: count,
      });
    });
    ratings = after;
  }

  return {ratings, history};
}
