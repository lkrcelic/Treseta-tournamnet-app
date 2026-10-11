import {Prisma} from "@prisma/client";
import {BYE_TEAM_ID, isByeTeam} from "@/app/_lib/bye";
import {RatedRound, replaySeason} from "@/app/_lib/rating/season";
import {ratedPlayerIds} from "@/app/_lib/lineup";

// Recalculation after an admin changes results that were already counted (edited hands of a finished match, a table
// re-paired or removed, a round deleted).

// The replay rates every round from this date on. It is before the app's first league night, so the whole Treseta
// history is rated (ratings came with the switch to the Bela app design, with no earlier live ratings to match).
export const RATINGS_FROM = new Date("2025-08-01T00:00:00Z");

// Held by every rating write (round close and replay), so a replay never interleaves with a live update
export const RATINGS_LOCK = 7314001;

export async function lockRatings(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${RATINGS_LOCK})`;
}

// Recomputes the season table rows of these teams from their closed rounds
export async function recalcTeamScores(tx: Prisma.TransactionClient, leagueId: number, teamIds: Iterable<number>) {
  for (const teamId of Array.from(new Set(teamIds))) {
    if (isByeTeam(teamId)) continue;
    await tx.$executeRaw`CALL update_team_score(${teamId}, ${leagueId})`;
  }
}

// Ratings from scratch (Glicko-2, see rating/glicko2.ts): every player starts at the default and every rated round
// (closed, no bye, since RATINGS_FROM) is replayed, one rating period per league night, each match a game. A round
// counts for its lineup (the players picked on Start Game); a round without one counts for today's rosters, as
// older rounds don't keep who played. Also rewrites the per-night history the ratings page shows.
// Runs whenever a round closes or a counted result changes, so tonight's rounds always form one period.
export async function replayRatings(tx: Prisma.TransactionClient) {
  await lockRatings(tx);

  const players = await tx.player.findMany({select: {id: true}});
  const rounds = await tx.round.findMany({
    where: {
      open: false,
      team1_id: {not: BYE_TEAM_ID},
      team2_id: {not: BYE_TEAM_ID},
      round_date: {gte: RATINGS_FROM},
    },
    orderBy: [{round_date: "asc"}, {round_number: "asc"}, {table_number: "asc"}, {id: "asc"}],
    select: {
      round_date: true,
      team1_wins: true,
      team2_wins: true,
      team1_id: true,
      team2_id: true,
      team1: {select: {teamPlayers: {select: {player_id: true}}}},
      team2: {select: {teamPlayers: {select: {player_id: true}}}},
      roundPlayers: {select: {player_id: true, team_id: true}},
      matches: {select: {player_pair1_score: true, player_pair2_score: true}, orderBy: {id: "asc"}},
    },
  });

  const rated: RatedRound[] = rounds.map((r) => ({
    night: r.round_date!.toISOString().slice(0, 10),
    teamA: ratedPlayerIds(r.roundPlayers, r.team1_id, r.team1.teamPlayers.map((p) => p.player_id)),
    teamB: ratedPlayerIds(r.roundPlayers, r.team2_id, r.team2.teamPlayers.map((p) => p.player_id)),
    matches: r.matches.map((m) => [m.player_pair1_score, m.player_pair2_score]),
    wins: [r.team1_wins, r.team2_wins],
  }));
  const {ratings, history} = replaySeason(players.map((p) => p.id), rated);

  if (ratings.size > 0) {
    const rows = Array.from(ratings, ([id, r]) => Prisma.sql`(${id}::int, ${Math.round(r.rating)}::int, ${r.rd}::float8, ${r.vol}::float8)`);
    await tx.$executeRaw`
        UPDATE "Player" AS p
        SET rating = v.rating, rating_deviation = v.rd, volatility = v.vol
        FROM (VALUES ${Prisma.join(rows)}) AS v(id, rating, rd, vol)
        WHERE p.id = v.id`;
  }

  await tx.playerRatingHistory.deleteMany({});
  for (let i = 0; i < history.length; i += 1000) {
    await tx.playerRatingHistory.createMany({
      data: history.slice(i, i + 1000).map((h) => ({
        player_id: h.playerId,
        night: new Date(`${h.night}T00:00:00Z`),
        rating: h.rating,
        rating_deviation: h.rd,
        change: h.change,
        rounds: h.rounds,
      })),
    });
  }
}

// A round whose result counts for ratings: closed and without a bye
export function isRatedRound(r: {open: boolean; team1_id: number; team2_id: number}) {
  return !r.open && !isByeTeam(r.team1_id) && !isByeTeam(r.team2_id);
}
