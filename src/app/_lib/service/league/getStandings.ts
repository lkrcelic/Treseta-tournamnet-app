import {prisma} from "@/app/_lib/prisma";
import {TeamScore} from "@prisma/client";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {leagueDateString} from "@/app/_lib/dates";
import {movementShown, rankMovement, TeamTotals} from "@/app/_lib/movement";
import {getRoundDatesByLeagueId} from "@/app/_lib/service/league/getRoundDatesById";

export type LeagueStandingsRow = Omit<TeamScore, "id"> & {id: number | null; team: {team_name: string}};

// Every team of the league, also those that haven't finished a round yet (a TeamScore row is only written when a
// team finishes its first round): they are listed with zeros. Inactive teams stay in the table; a team taken out of
// the league does not, even if a later correction of its old rounds wrote its row again.
export async function getLeagueStandings(league_id: number): Promise<LeagueStandingsRow[]> {
  const [scores, leagueTeams] = await Promise.all([
    prisma.teamScore.findMany({
      include: {team: {select: {team_name: true}}},
      where: {league_id, team_id: {not: BYE_TEAM_ID}},
    }),
    prisma.leagueTeam.findMany({
      where: {league_id, team_id: {not: BYE_TEAM_ID}},
      select: {team_id: true, team: {select: {team_name: true}}},
    }),
  ]);

  const inLeague = new Set(leagueTeams.map((lt) => lt.team_id));
  const scored = new Set(scores.map((s) => s.team_id));
  const notPlayedYet: LeagueStandingsRow[] = leagueTeams
    .filter((lt) => !scored.has(lt.team_id))
    .map((lt) => ({
      id: null,
      team_id: lt.team_id,
      league_id,
      rounds_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      point_difference: 0,
      score: 0,
      team: lt.team,
    }));

  return [...scores.filter((s) => inLeague.has(s.team_id)), ...notPlayedYet].sort(
    (a, b) =>
      b.score - a.score ||
      b.point_difference - a.point_difference ||
      a.team.team_name.localeCompare(b.team.team_name, "hr")
  );
}

// Ukupni poredak with the +/− (handoff "promjena mjesta"): each team's change of place since the league's previous
// night (null: it hadn't played by then). movementSince is that night (YYYY-MM-DD); showMovement is false on the
// league's first night and once the league is over (movementShown), and then every movement is null.
export type LeagueStandingsWithMovement = {
  standings: (LeagueStandingsRow & {movement: number | null})[];
  showMovement: boolean;
  movementSince: string | null;
};

const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export async function getLeagueStandingsWithMovement(league_id: number): Promise<LeagueStandingsWithMovement> {
  const [rows, nights, league] = await Promise.all([
    getLeagueStandings(league_id),
    getRoundDatesByLeagueId(league_id),
    prisma.league.findUnique({
      where: {league_id},
      select: {end_date: true, nights: {select: {night: true}, orderBy: {night: "desc"}, take: 1}},
    }),
  ]);
  const {show, since} = movementShown(nights, isoDate(league?.end_date), isoDate(league?.nights[0]?.night), leagueDateString());
  if (!show || since == null) return {standings: rows.map((r) => ({...r, movement: null})), showMovement: false, movementSince: null};

  const current: TeamTotals[] = rows.map((r) => ({
    team_id: r.team_id,
    name: r.team.team_name,
    score: r.score,
    point_difference: r.point_difference,
    rounds_played: r.rounds_played,
  }));
  const movement = rankMovement(current, await standingsUntil(league_id, since));
  return {standings: rows.map((r) => ({...r, movement: movement.get(r.team_id) ?? null})), showMovement: true, movementSince: since};
}

type Totals = Omit<TeamTotals, "team_id" | "name">;

// The season table as it was after a night: what TeamScore holds (update_team_score), counting only the published
// rounds closed on or before that date. A round without a date counts as earlier, as it counts in TeamScore.
export async function standingsUntil(league_id: number, night: string): Promise<Map<number, Totals>> {
  const rows = await prisma.$queryRaw<(Totals & {team_id: number})[]>`
      WITH closed AS (SELECT r.id, r.team1_id, r.team2_id, r.team1_wins, r.team2_wins
                      FROM "Round" r
                               JOIN "LeagueRound" lr ON lr.round_id = r.id
                      WHERE lr.league_id = ${league_id}
                        AND r.open = false
                        AND r.status = 'PUBLISHED'
                        AND (r.round_date IS NULL OR r.round_date <= ${night}::date)),
           sides AS (SELECT id, team1_id AS team_id, team1_wins AS won, team2_wins AS lost, 1 AS sign
                     FROM closed
                     UNION ALL
                     SELECT id, team2_id, team2_wins, team1_wins, -1
                     FROM closed),
           diffs AS (SELECT c.id, SUM(m.player_pair1_score - m.player_pair2_score) AS diff
                     FROM closed c
                              JOIN "Match" m ON m.round_id = c.id
                     GROUP BY c.id)
      SELECT s.team_id,
             COUNT(*)::int                                                                        AS rounds_played,
             (2 * COUNT(*) FILTER (WHERE s.won > s.lost) + COUNT(*) FILTER (WHERE s.won = s.lost))::int AS score,
             COALESCE(SUM(s.sign * d.diff), 0)::int                                               AS point_difference
      FROM sides s
               LEFT JOIN diffs d ON d.id = s.id
      WHERE s.team_id <> ${BYE_TEAM_ID}
      GROUP BY s.team_id`;
  return new Map(rows.map(({team_id, ...totals}) => [team_id, totals]));
}
