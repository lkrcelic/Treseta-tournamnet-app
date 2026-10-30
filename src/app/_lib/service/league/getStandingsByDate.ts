import {prisma} from "@/app/_lib/prisma";
import {LeagueRow, needsHeadToHead, rankLeague} from "@/app/_lib/leagueOrder";
import {leagueTables} from "@/app/_lib/service/league/getStandings";

// A team's line of a night's table, as get_league_standings_by_date gives it (its counts are NUMERIC)
type DailyRow = {team_id: number; rounds_played: unknown; score: unknown; point_difference: unknown; team: {team_name: string}};

const numbersOf = (r: DailyRow): LeagueRow => ({
  team_id: Number(r.team_id),
  name: r.team.team_name,
  score: Number(r.score),
  point_difference: Number(r.point_difference),
  rounds_played: Number(r.rounds_played),
});

// Dnevni poredak: a night's table in the league's order (leagueOrder.ts, DECISIONS #74): points, difference, the
// head-to-head of the teams still level counted from that night's tables, then the name (Croatian alphabet, as Ukupni
// poredak). The name keeps the order still early in the night, when every team is 0 / 0, so places don't change on
// every load and poll.
export async function getLeagueStandingsByDate(league_id: number, round_date: string): Promise<DailyRow[]> {
  // round_date is YYYY-MM-DD; parsed as UTC midnight, so toISOString keeps the same day
  const night = new Date(round_date).toISOString().split("T")[0];

  const rows = await prisma.$queryRaw<DailyRow[]>`
      SELECT standings.*,
             json_build_object('team_name', t.team_name) AS team
      FROM get_league_standings_by_date(${league_id}, ${night}::DATE) standings
               JOIN "Team" t ON standings.team_id = t.team_id
  `;
  // the night's tables only when two teams that have played are level
  const tables = needsHeadToHead(rows.map(numbersOf)) ? await leagueTables(league_id, night) : [];
  return rankLeague(rows, numbersOf, tables);
}
