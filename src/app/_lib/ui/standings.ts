import {signed} from "./text";

// One team's line in the league or daily standings, as returned by the standings APIs
export type StandingsItem = {
  id?: string | number;
  team_id?: number;
  team: {team_name: string};
  rounds_played: number;
  wins: number;
  draws: number;
  losses: number;
  point_difference: number;
  score: number;
  active_round_count?: number;
};

export type StandingsRow = {
  key: string;
  rank: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  diff: string;
  points: number;
  live: boolean;
  mine: boolean;
};

export function toStandingsRows(items: StandingsItem[] | null | undefined, myTeamNames: string[] = []): StandingsRow[] {
  const mine = new Set(myTeamNames);
  return (items ?? []).map((s, i) => ({
    key: String(s.team_id ?? s.id ?? s.team?.team_name ?? i),
    rank: i + 1,
    name: s.team?.team_name ?? "—",
    played: Number(s.rounds_played ?? 0),
    wins: Number(s.wins ?? 0),
    draws: Number(s.draws ?? 0),
    losses: Number(s.losses ?? 0),
    diff: signed(Number(s.point_difference ?? 0)),
    points: Number(s.score ?? 0),
    live: Number(s.active_round_count ?? 0) > 0,
    mine: mine.has(s.team?.team_name),
  }));
}

// The second line of a phone standings row: "24 OK · 19 POB · 3 NER · 2 IZG" (OK only in the league table)
export function statsLine(row: StandingsRow, withPlayed: boolean): string {
  const base = `${row.wins} POB · ${row.draws} NER · ${row.losses} IZG`;
  return withPlayed ? `${row.played} OK · ${base}` : base;
}

// Top three for the podium and the rest for the list. With fewer than 3 teams, or before anyone has played
// (the league table lists new teams with zeros), there is no podium.
export function splitPodium(rows: StandingsRow[]): {podium: StandingsRow[]; rest: StandingsRow[]} {
  if (rows.length < 3 || rows.every((r) => r.played === 0)) return {podium: [], rest: rows};
  return {podium: rows.slice(0, 3), rest: rows.slice(3)};
}
