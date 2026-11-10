// The order of the league's standings, Ukupni and Dnevni poredak (DECISIONS #74): points, then the difference, then the
// head-to-head among the teams still level (the points and then the difference of only their tables against each
// other), then the name. It is the tournaments' order too (rankTeams, _lib/tournaments.ts), which the league simply
// feeds its own rows. Framework free so it can be unit tested.
import {rankTeams, TableResult} from "@/app/_lib/tournaments";

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
  // a league's table always plays two matches, so a win is worth two points
  matches: 2,
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
