import {prisma} from "@/app/_lib/prisma";
import {Team} from "../../matching/multipleRoundMatching";

export async function getLeagueTeamsWithScores(leagueId: number): Promise<Team[]> {
  const data = await prisma.$queryRaw<Team[]>`
      SELECT t.team_id           AS id,
             t.team_name         AS name,
             -- a team without a TeamScore row yet (new team) counts as 0, not NULL (which sorts first)
             COALESCE(ts.score, 0)            AS score,
             COALESCE(ts.point_difference, 0) AS point_difference,
             COALESCE(
                     ARRAY_AGG(
                             CASE
                                 WHEN r.team1_id = t.team_id THEN r.team2_id
                                 WHEN r.team2_id = t.team_id THEN r.team1_id
                                 END
                     ) FILTER(WHERE r.id IS NOT NULL),
                     '{}' ::int[]
             )                   AS played_against
      FROM "Team" t
               LEFT JOIN "TeamScore" ts
                         ON t.team_id = ts.team_id AND ts.league_id = ${leagueId}
               -- only this league's rounds count as already played against
               LEFT JOIN "Round" r
                         ON (r.team1_id = t.team_id OR r.team2_id = t.team_id)
                             AND EXISTS (SELECT 1
                                         FROM "LeagueRound" lr
                                         WHERE lr.round_id = r.id
                                           AND lr.league_id = ${leagueId})
               JOIN "LeagueTeam" lt
                    ON lt.team_id = t.team_id
      WHERE lt.league_id = ${leagueId}
      GROUP BY t.team_id, t.team_name, ts.score, ts.point_difference
      ORDER BY COALESCE(ts.score, 0) DESC, COALESCE(ts.point_difference, 0) DESC
  `;

  return data as Team[];
}

