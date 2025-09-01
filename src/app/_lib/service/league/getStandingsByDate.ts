import {prisma} from "@/app/_lib/prisma";

export async function getLeagueStandingsByDate(
  league_id: number,
  round_date: string
): Promise<unknown> {
  const roundDateFormatted = new Date(round_date).toISOString().split('T')[0];

  return prisma.$queryRaw`
      SELECT standings.*,
             json_build_object('team_name', t.team_name) AS team
      FROM get_league_standings_by_date(${league_id}, ${roundDateFormatted}::DATE) standings
               JOIN "Team" t ON standings.team_id = t.team_id
      ORDER BY standings.score DESC, standings.point_difference DESC
  `;
}
