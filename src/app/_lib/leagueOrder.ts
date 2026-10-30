// The order of the league's standings, Ukupni and Dnevni poredak (DECISIONS #74): points, then the difference, then the
// head-to-head among the teams still level (the points and then the difference of only their tables against each
// other), then the name. It is Bela's tournament order (rankTeams, from its _lib/tournaments.ts, which Treseta doesn't
// copy: its standings part is here). Framework free so it can be unit tested.
import {isByeTeam} from "@/app/_lib/bye";

// A published table as the standings read it
type TableResult = {
  kolo: number;
  team1Id: number;
  team2Id: number;
  team1Wins: number;
  team2Wins: number;
  open: boolean;
  // play has started at it (a match is running or was played)
  started: boolean;
  // team1's points minus team2's, over the matches played
  diff: number;
  // false for a skipped table (Nedolazak za stol: nobody started or answered in 10 minutes): it isn't counted
  scored: boolean;
};

type TeamTotals = {
  teamId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  // a win 2, a draw 1
  points: number;
  difference: number;
  // a table of the team is being played
  live: boolean;
};

// Every team's totals from the tables played to the end, as in the league: a table won (more matches won) is a win,
// equal matches a draw; the difference is of the points of every match played, the bye's matches too. A skipped table counts for nobody. Teams without a table yet have zeros.
function tournamentTotals(teamIds: number[], tables: TableResult[]): Map<number, TeamTotals> {
  const totals = new Map<number, TeamTotals>(
    teamIds.map((id) => [id, {teamId: id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, difference: 0, live: false}])
  );
  const side = (id: number) => {
    if (isByeTeam(id)) return null;
    let t = totals.get(id);
    if (!t) {
      // a team that left the tournament after it played keeps its results
      t = {teamId: id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, difference: 0, live: false};
      totals.set(id, t);
    }
    return t;
  };
  for (const table of tables) {
    const sides: [TeamTotals | null, number, number, number][] = [
      [side(table.team1Id), table.team1Wins, table.team2Wins, table.diff],
      [side(table.team2Id), table.team2Wins, table.team1Wins, -table.diff],
    ];
    for (const [t, won, lost, diff] of sides) {
      if (!t) continue;
      if (table.open) {
        if (table.started) t.live = true;
        continue;
      }
      if (!table.scored) continue;
      t.played += 1;
      if (won > lost) t.wins += 1;
      else if (won === lost) t.draws += 1;
      else t.losses += 1;
      t.difference += diff;
    }
  }
  totals.forEach((t) => (t.points = 2 * t.wins + t.draws));
  return totals;
}

// The standings order: points, then the difference, then the head-to-head ("međusobni omjer"): among the teams level
// on both, the points and then the difference of only the tables they played against each other; then the name. Without
// tables only points, difference and name count.
function rankTeams<T extends {name: string; totals: TeamTotals}>(teams: T[], tables: TableResult[] = []): T[] {
  const sorted = [...teams].sort(
    (a, b) => b.totals.points - a.totals.points || b.totals.difference - a.totals.difference || a.name.localeCompare(b.name, "hr")
  );
  const out: T[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].totals.points === sorted[i].totals.points && sorted[j].totals.difference === sorted[i].totals.difference) j++;
    const group = sorted.slice(i, j);
    if (group.length > 1 && tables.length > 0) {
      const ids = new Set(group.map((t) => t.totals.teamId));
      const mutual = tournamentTotals(Array.from(ids), tables.filter((t) => ids.has(t.team1Id) && ids.has(t.team2Id)));
      const h2h = (t: T) => mutual.get(t.totals.teamId)!;
      group.sort((a, b) => h2h(b).points - h2h(a).points || h2h(b).difference - h2h(a).difference || a.name.localeCompare(b.name, "hr"));
    }
    out.push(...group);
    i = j;
  }
  return out;
}

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
