import {prisma} from "@/app/_lib/prisma";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {ratedPlayerIds} from "@/app/_lib/lineup";
import {PROVISIONAL_ROUNDS} from "@/app/_lib/rating/glicko2";
import {roundGames} from "@/app/_lib/rating/season";
import {RATINGS_FROM} from "@/app/_lib/service/admin/recalc";
import {NotFoundError} from "@/app/_lib/service/admin/tables";
import {PlayerRatingDetail, RatingNight, RatingRow, RatingsList} from "@/app/_interfaces/ratings";

// Player ratings across all leagues: everyone on a team or with a rated round, highest rating first

type Row = {id: number; first_name: string; last_name: string; username: string; rating: number; team: string | null; rounds: number; change: number | null};

export async function listRatings(viewerId: number | null): Promise<RatingsList> {
  const rows = await prisma.$queryRaw<Row[]>`
      SELECT p.id, p.first_name, p.last_name, p.username, p.rating,
             team.team_name                AS team,
             COALESCE(h.rounds, 0)::int    AS rounds,
             h.change
      FROM "Player" p
               LEFT JOIN (SELECT player_id,
                                 SUM(rounds)                                AS rounds,
                                 (ARRAY_AGG(change ORDER BY night DESC))[1] AS change
                          FROM "PlayerRatingHistory"
                          GROUP BY player_id) h ON h.player_id = p.id
               -- the player's team that played most recently (a player can be on more than one)
               LEFT JOIN LATERAL (
          SELECT t.team_name
          FROM "TeamPlayer" tp
                   JOIN "Team" t ON t.team_id = tp.team_id
          WHERE tp.player_id = p.id
            AND t.team_id <> ${BYE_TEAM_ID}
          ORDER BY (SELECT MAX(r.round_date) FROM "Round" r WHERE r.team1_id = t.team_id OR r.team2_id = t.team_id) DESC NULLS LAST,
                   t.team_name
          LIMIT 1) team ON true
      WHERE h.player_id IS NOT NULL
         OR EXISTS (SELECT 1 FROM "TeamPlayer" tp WHERE tp.player_id = p.id AND tp.team_id <> ${BYE_TEAM_ID})`;

  const players = rows
    .map((r) => ({...r, name: `${r.first_name} ${r.last_name}`.trim() || r.username}))
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name, "hr"));

  let rank = 0;
  const list: RatingRow[] = players.map((p, i) => {
    if (i === 0 || p.rating !== players[i - 1].rating) rank = i + 1;
    return {
      id: p.id,
      rank,
      name: p.name,
      username: p.username,
      team: p.team,
      rating: p.rating,
      change: p.change,
      rounds: p.rounds,
      provisional: p.rounds < PROVISIONAL_ROUNDS,
    };
  });

  return {players: list, me: viewerId != null && list.some((p) => p.id === viewerId) ? viewerId : null};
}

export async function getPlayerRating(playerId: number): Promise<PlayerRatingDetail> {
  const {players} = await listRatings(null);
  const player = players.find((p) => p.id === playerId);
  if (!player) throw new NotFoundError("Player not found.");

  const history = await prisma.playerRatingHistory.findMany({
    where: {player_id: playerId},
    orderBy: {night: "asc"},
    select: {night: true, rating: true, change: true},
  });

  return {
    player,
    total: players.length,
    history: history.map((h) => ({night: isoDate(h.night), rating: h.rating})),
    lastNights: await lastNights(playerId, history.slice(-5).reverse()),
  };
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// What the player played on each of these nights: the opponents and the matches won and lost, from the same rounds
// the rating replay counted for them
async function lastNights(playerId: number, nights: {night: Date; change: number}[]): Promise<RatingNight[]> {
  if (nights.length === 0) return [];
  const teamIds = (await prisma.teamPlayer.findMany({where: {player_id: playerId}, select: {team_id: true}})).map((t) => t.team_id);
  const rounds = await prisma.round.findMany({
    where: {
      open: false,
      round_date: {in: nights.map((n) => n.night), gte: RATINGS_FROM},
      team1_id: {not: BYE_TEAM_ID},
      team2_id: {not: BYE_TEAM_ID},
      OR: [{roundPlayers: {some: {player_id: playerId}}}, {team1_id: {in: teamIds}}, {team2_id: {in: teamIds}}],
    },
    orderBy: [{round_number: "asc"}, {id: "asc"}],
    select: {
      round_date: true,
      team1_id: true,
      team2_id: true,
      team1_wins: true,
      team2_wins: true,
      team1: {select: {team_name: true, teamPlayers: {select: {player_id: true}}}},
      team2: {select: {team_name: true, teamPlayers: {select: {player_id: true}}}},
      roundPlayers: {select: {player_id: true, team_id: true}},
      matches: {select: {player_pair1_score: true, player_pair2_score: true}, orderBy: {id: "asc"}},
    },
  });

  return nights.map(({night, change}) => {
    const out: RatingNight = {night: isoDate(night), opponents: [], won: 0, lost: 0, change};
    for (const r of rounds) {
      if (isoDate(r.round_date!) !== out.night) continue;
      const teamA = ratedPlayerIds(r.roundPlayers, r.team1_id, r.team1.teamPlayers.map((p) => p.player_id));
      const teamB = ratedPlayerIds(r.roundPlayers, r.team2_id, r.team2.teamPlayers.map((p) => p.player_id));
      const side = teamA.includes(playerId) ? 1 : teamB.includes(playerId) ? 2 : 0;
      if (!side) continue;
      out.opponents.push(side === 1 ? r.team2.team_name : r.team1.team_name);
      const games = roundGames({
        night: out.night,
        teamA,
        teamB,
        matches: r.matches.map((m) => [m.player_pair1_score, m.player_pair2_score]),
        wins: [r.team1_wins, r.team2_wins],
      });
      for (const g of games) {
        const mine = side === 1 ? g.scoreA : 1 - g.scoreA;
        if (mine === 1) out.won++;
        else if (mine === 0) out.lost++;
      }
    }
    return out;
  });
}
