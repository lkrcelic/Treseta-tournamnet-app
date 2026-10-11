import {isByeTeam} from "@/app/_lib/bye";
import {matchesQuery} from "./text";

// One table (round) of a round number on a given night, flattened for display
export type TableRow = {
  id: number;
  table: number;
  teamA: string;
  teamB: string;
  teamAId: number;
  teamBId: number;
  winsA: number;
  winsB: number;
  live: boolean;
  // the round is closed (both matches played)
  done: boolean;
  // current match points while live, e.g. 724 and 588
  pointsA: number | null;
  pointsB: number | null;
  mine: boolean;
  // something was played at the table (a match running or finished)
  started: boolean;
  // one side is the bye: settled 2:0 when created, nothing to play
  bye: boolean;
};

export type TableFilter = "all" | "live" | "done";

// the API's round shape (fields are optional in the inferred zod types)
type RoundLike = {
  id?: number;
  table_number?: number | null;
  team1_id?: number;
  team2_id?: number;
  team1?: {team_name?: string} | null;
  team2?: {team_name?: string} | null;
  team1_wins?: number;
  team2_wins?: number;
  active?: boolean;
  open?: boolean;
  ongoingMatches?: {player_pair1_score?: number; player_pair2_score?: number}[] | null;
};

export function toTableRows(rounds: RoundLike[], myTeamNames: string[] = []): TableRow[] {
  const mine = new Set(myTeamNames);
  return rounds
    .map((r, i) => {
      const live = !!r.active;
      const om = r.ongoingMatches && r.ongoingMatches.length ? r.ongoingMatches[r.ongoingMatches.length - 1] : null;
      const teamA = r.team1?.team_name ?? `Team ${r.team1_id}`;
      const teamB = r.team2?.team_name ?? `Team ${r.team2_id}`;
      return {
        id: r.id ?? i,
        table: r.table_number || i + 1,
        teamA,
        teamB,
        teamAId: r.team1_id ?? 0,
        teamBId: r.team2_id ?? 0,
        winsA: r.team1_wins ?? 0,
        winsB: r.team2_wins ?? 0,
        live,
        done: r.open === false,
        pointsA: live && om ? om.player_pair1_score ?? 0 : null,
        pointsB: live && om ? om.player_pair2_score ?? 0 : null,
        mine: mine.has(teamA) || mine.has(teamB),
        started: live || r.open === false || (r.team1_wins ?? 0) + (r.team2_wins ?? 0) > 0 || !!om,
        bye: isByeTeam(r.team1_id ?? -1) || isByeTeam(r.team2_id ?? -1),
      };
    })
    .sort((a, b) => a.table - b.table);
}

// Filter by status and by a search on team name or exact table number
export function filterTables(rows: TableRow[], filter: TableFilter, query = ""): TableRow[] {
  const q = query.trim();
  return rows.filter((t) => {
    if (filter === "live" && !t.live) return false;
    if (filter === "done" && !t.done) return false;
    if (!q) return true;
    return String(t.table) === q || matchesQuery(t.teamA, q) || matchesQuery(t.teamB, q);
  });
}

// How many columns the desktop round view uses. With fitRows (how many rows fit the height on screen): one column
// while every table fits, otherwise as few as fit, up to three. Before the height is known: one up to 16 teams, two
// up to 60, three above.
export function tableColumns(tableCount: number, fitRows?: number): number {
  if (fitRows != null && fitRows > 0) return Math.min(3, Math.max(1, Math.ceil(tableCount / fitRows)));
  const teams = tableCount * 2;
  if (teams <= 16) return 1;
  if (teams <= 60) return 2;
  return 3;
}

// Splits rows into `n` columns, filling each column top to bottom
export function splitColumns<T>(rows: T[], n: number): T[][] {
  const cols = Math.max(1, n);
  const height = Math.max(1, Math.ceil(rows.length / cols));
  return Array.from({length: cols}, (_, c) => rows.slice(c * height, (c + 1) * height));
}

// Number of live tables, for the LIVE pill and the "30 stolova · 6 uživo" summary
export function liveCount(rows: {live: boolean}[]): number {
  return rows.filter((r) => r.live).length;
}
