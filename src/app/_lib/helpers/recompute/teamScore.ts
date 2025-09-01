import {prisma} from "@/app/_lib/prisma";
import {Prisma} from "@prisma/client";

export async function recomputeTeamScore(leagueId: number): Promise<boolean> {
  const rounds = await prisma.leagueRound.findMany({
    where: {league_id: leagueId},
    select: {round_id: true},
  });
  const roundIds: number[] = rounds.map((r) => r.round_id);
  if (!roundIds.length) return false;

  const scores: unknown[] = await prisma.$queryRaw`
    WITH RoundWinners AS(
      SELECT
        m.round_id,
        CASE
          WHEN SUM(CASE WHEN m.player_pair1_score > m.score_threshold THEN 1 ELSE 0 END) >
               SUM(CASE WHEN m.player_pair2_score > m.score_threshold THEN 1 ELSE 0 END)
          THEN 1
          WHEN SUM(CASE WHEN m.player_pair2_score > m.score_threshold THEN 1 ELSE 0 END) >
               SUM(CASE WHEN m.player_pair1_score > m.score_threshold THEN 1 ELSE 0 END)
          THEN 2
          ELSE 0
        END AS winner
      FROM "Match" m
      WHERE m.round_id IN (${Prisma.join(roundIds)})
      GROUP BY m.round_id
      HAVING COUNT(*) > 1) -- exclude rounds that have not been finished.
    SELECT
      t.team_id AS team_id,
      SUM(
        CASE
          WHEN rw.winner = 1 AND t.team_id = r.team1_id THEN 3
          WHEN rw.winner = 1 AND t.team_id = r.team2_id THEN 3
          WHEN rw.winner = 0 THEN 1
          ELSE 0
        END
      )::integer AS score
    FROM "Team" t
    JOIN "Round" r on (t.team_id = r.team1_id OR t.team_id = r.team2_id)
    JOIN RoundWinners rw ON rw.round_id = r.id
    GROUP BY t.team_id;
    `;

  await prisma.teamScore.deleteMany({where: {league_id: leagueId}});

  scores.forEach((s) => {
    s.league_id = leagueId;
  });
  await prisma.teamScore.createMany({data: scores});

  return true;
}
