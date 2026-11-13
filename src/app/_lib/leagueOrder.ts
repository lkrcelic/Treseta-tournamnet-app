// The order of the league's standings, Ukupni and Dnevni poredak (DECISIONS #74): points, then the difference, then the
// head-to-head among the teams still level (the points and then the difference of only their tables against each
// other), then the name. It is a tournament's order (rankTeams), so the two never drift apart. Framework free so it can
// be unit tested.
import {rankTeams, TableResult} from "@/app/_lib/tournaments";

// The league's points for a table: 2 for a win, 1 for a draw, 0 for a loss. The same rule is written three more
// times, which must change with these: the update_team_score procedure (the latest one in prisma/migrations, it writes
// TeamScore), standingsUntil's SQL (the table after an earlier night, for the +/−) and rankTeams, which gives a
// table won `matches` points and a draw 1 (asResult below). db/standings.test.ts checks that the first two agree.
export const LEAGUE_WIN_POINTS = 2;
export const LEAGUE_DRAW_POINTS = 1;

// A team's points for one table it won `won` and lost `lost` matches of
export const leaguePoints = (won: number, lost: number): number =>
  won > lost ? LEAGUE_WIN_POINTS : won === lost ? LEAGUE_DRAW_POINTS : 0;

// A team's numbers as the order reads them
export type LeagueRow = {team_id: number; name: string; score: number; point_difference: number; rounds_played: number};

// A closed, published table of the league: its teams, the matches each won and team1's points minus team2's over them
export type LeagueTable = {team1_id: number; team2_id: number; team1_wins: number; team2_wins: number; diff: number};

const asResult = (t: LeagueTable): TableResult => ({
  kolo: 0,
  team1Id: t.team1_id,
  team2Id: t.team2_id,
  team1Wins: t.team1_wins,
  team2Wins: t.team2_wins,
  open: false,
  started: true,
  diff: t.diff,
  scored: true,
  // rankTeams gives a won table `matches` points, so the league's win; a draw it counts 1 (LEAGUE_DRAW_POINTS)
  matches: LEAGUE_WIN_POINTS,
});

// The rows in the league's order; of: a row's numbers. Without tables the head-to-head can't decide, and the name does.
export function rankLeague<T>(rows: T[], of: (row: T) => LeagueRow, tables: LeagueTable[] = []): T[] {
  const wrapped = rows.map((row) => {
    const r = of(row);
    return {row, name: r.name, totals: {teamId: r.team_id, played: r.rounds_played, wins: 0, draws: 0, losses: 0, points: r.score, difference: r.point_difference, live: false}};
  });
  return rankTeams(wrapped, tables.map(asResult)).map((w) => w.row);
}

// Two teams that have played are level on points and difference: only then does the order need the tables
export function needsHeadToHead(rows: LeagueRow[]): boolean {
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.rounds_played === 0) continue;
    const key = `${r.score}|${r.point_difference}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
