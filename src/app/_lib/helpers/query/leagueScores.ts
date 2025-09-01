import {prisma} from "@/app/_lib/prisma";
import {Team} from "../../matching/multipleRoundMatching";

export async function getLeagueTeamsWithScores(leagueId: number): Promise<Team[]> {
  const data = await prisma.$queryRaw<Team[]>`
      SELECT t.team_id           AS id,
             t.team_name         AS name,
             ts.score            AS score,
             ts.point_difference AS point_difference,
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
               LEFT JOIN "Round" r
                         ON r.team1_id = t.team_id OR r.team2_id = t.team_id
               JOIN "LeagueTeam" lt
                    ON lt.team_id = t.team_id
      WHERE lt.league_id = ${leagueId}
      GROUP BY t.team_id, t.team_name, ts.score, ts.point_difference
  `;

  return data as Team[];
}

