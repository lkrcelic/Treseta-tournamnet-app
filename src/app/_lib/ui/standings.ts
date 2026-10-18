import {Conference, ConferenceOf} from "@/app/_lib/conferences";
import {formatChange} from "./ratings";
import {displayDate} from "./text";

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
  // Ukupni poredak: places gained (+) or lost (−) since the league's previous night; null when the team wasn't in
  // that night's table
  movement?: number | null;
  // the team's photo for the avatar (null or absent: its letter)
  photo_url?: string | null;
};

export type StandingsRow = {
  key: string;
  // the team's page (/teams/<id>); null when the API gave no id
  teamId: number | null;
  rank: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  // "+612", "−5" (a real minus sign, as on the Team and Player pages), "0"
  diff: string;
  points: number;
  live: boolean;
  // the row in cream with the navy bar: the player's own team, or the team the page was opened for
  highlight: boolean;
  // the team's conference (its dot): undefined when the league has none, null when the team has none
  conference?: Conference | null;
  // places gained (+) or lost (−) since the league's previous night (Ukupni poredak's +/−); null: no change to show
  movement: number | null;
  // the team's photo; null = its letter in the avatar
  photo: string | null;
};

type StandingsHighlight = {
  // the player's teams, by name (the standings APIs have no player data)
  myTeamNames?: string[];
  // a league's standings opened from a Team page (?team=<id>): only that team is highlighted, not the player's own
  highlightTeamId?: number | null;
  // the league's conferences, for the dots (left out: no dots)
  conferenceOf?: ConferenceOf;
};

export function toStandingsRows(items: StandingsItem[] | null | undefined, {myTeamNames = [], highlightTeamId = null, conferenceOf}: StandingsHighlight = {}): StandingsRow[] {
  const mine = new Set(myTeamNames);
  return (items ?? []).map((s, i) => {
    const teamId = s.team_id != null && Number.isInteger(Number(s.team_id)) ? Number(s.team_id) : null;
    return {
      key: String(s.team_id ?? s.id ?? s.team?.team_name ?? i),
      teamId,
      rank: i + 1,
      name: s.team?.team_name ?? "—",
      played: Number(s.rounds_played ?? 0),
      wins: Number(s.wins ?? 0),
      draws: Number(s.draws ?? 0),
      losses: Number(s.losses ?? 0),
      diff: formatChange(Number(s.point_difference ?? 0)),
      points: Number(s.score ?? 0),
      live: Number(s.active_round_count ?? 0) > 0,
      highlight: highlightTeamId != null ? teamId === highlightTeamId : mine.has(s.team?.team_name),
      conference: conferenceOf && teamId != null ? conferenceOf(teamId) : undefined,
      movement: typeof s.movement === "number" ? s.movement : null,
      photo: typeof s.photo_url === "string" ? s.photo_url : null,
    };
  });
}

// How a row's place is drawn (RankNumber, design "Redni brojevi" 1b · Samo broj): red while the team is playing,
// navy for the player's own team or self, larger and darker for the top three of a teams' standings (never on
// Rejting), muted for the rest. Live wins over mine, mine over top.
export type RankTone = "top" | "me" | "live" | "plain";

export function rankTone(row: {rank: number; live?: boolean; highlight?: boolean}, {teams}: {teams: boolean}): RankTone {
  if (row.live) return "live";
  if (row.highlight) return "me";
  if (teams && row.rank >= 1 && row.rank <= 3) return "top";
  return "plain";
}

// A standings row opens its team's page (null: no id to link to)
export function standingsTeamHref(row: StandingsRow): string | null {
  return row.teamId != null ? `/teams/${row.teamId}` : null;
}

// The team id of a ?team= parameter (a league's standings opened from a Team page), or null for none or a bad one
export function highlightParam(value: string | null | undefined): number | null {
  if (value == null || !/^\d{1,9}$/.test(value.trim())) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

// One conference's view of a table: its teams in the same order, ranked from 1 (so splitPodium gives its podium).
// conferenceId null: the whole table.
export function inConference(rows: StandingsRow[], conferenceId: number | null): StandingsRow[] {
  if (conferenceId == null) return rows;
  return rows.filter((r) => r.conference?.id === conferenceId).map((r, i) => ({...r, rank: i + 1}));
}

// The second line of a phone standings row: "24 OK · 19 POB · 3 NER · 2 IZG" (OK only in the league table)
export function statsLine(row: StandingsRow, withPlayed: boolean): string {
  const {played, results} = statsParts(row, withPlayed);
  return played + results;
}

// The same line in two parts, so a narrow phone can leave out the first: "24 OK · " ("" without withPlayed) and
// "19 POB · 3 NER · 2 IZG"
export function statsParts(row: StandingsRow, withPlayed: boolean): {played: string; results: string} {
  return {played: withPlayed ? `${row.played} OK · ` : "", results: `${row.wins} POB · ${row.draws} NER · ${row.losses} IZG`};
}

// Top three for the podium and the rest for the list. With fewer than 3 teams, or before anyone has played
// (the league table lists new teams with zeros), there is no podium.
export function splitPodium(rows: StandingsRow[]): {podium: StandingsRow[]; rest: StandingsRow[]} {
  if (rows.length < 3 || rows.every((r) => r.played === 0)) return {podium: [], rest: rows};
  return {podium: rows.slice(0, 3), rest: rows.slice(3)};
}

// Ukupni poredak's +/− (handoff "promjena mjesta"): whether it is shown and the previous night it counts from
export type StandingsMovement = {show: boolean; since: string | null};

export const NO_MOVEMENT: StandingsMovement = {show: false, since: null};

// The standings API's answer: {standings, showMovement, movementSince} (a bare list, as before the +/−, has none)
export function readLeagueStandings(data: unknown): {items: StandingsItem[]; movement: StandingsMovement} {
  if (Array.isArray(data)) return {items: data as StandingsItem[], movement: NO_MOVEMENT};
  const d = (data ?? {}) as {standings?: unknown; showMovement?: unknown; movementSince?: unknown};
  const items = Array.isArray(d.standings) ? (d.standings as StandingsItem[]) : [];
  const since = typeof d.movementSince === "string" ? d.movementSince : null;
  return {items, movement: d.showMovement === true && since ? {show: true, since} : NO_MOVEMENT};
}

export type MovementKind = "up" | "down" | "same" | "none";

// How a row shows its +/−: an arrow and the places (▲2, ▼1), or "–" for the same place or a team that wasn't in the
// previous night's table; label is the tooltip and what a screen reader says
export function movementView(movement: number | null): {kind: MovementKind; text: string; label: string} {
  if (movement == null) return {kind: "none", text: "–", label: "Prošle večeri još nije bila u poretku"};
  if (movement > 0) return {kind: "up", text: String(movement), label: `Gore ${movement} od prošle večeri`};
  if (movement < 0) return {kind: "down", text: String(-movement), label: `Dolje ${-movement} od prošle večeri`};
  return {kind: "same", text: "–", label: "Isto mjesto kao prošle večeri"};
}

// The header's tooltip and the note under the desktop table
export const MOVEMENT_HEADER = "Promjena mjesta od prošle večeri lige";

export function movementNote(since: string): string {
  return `+/− pokazuje koliko je mjesta ekipa dobila ili izgubila od prošle večeri lige (${displayDate(since)}).`;
}
