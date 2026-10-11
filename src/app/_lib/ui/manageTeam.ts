import {matchesQuery} from "./text";

// Manage Teams: what the screen shows for a team, kept free of React so it can be tested

export type MTPlayer = {id: number; username: string; first_name: string; last_name: string};
export type MTLeague = {id: number; name: string; active: boolean};
export type MTTeam = {id: number; name: string; founders: number[]; players: MTPlayer[]; leagues: MTLeague[]};

type ApiTeam = {
  team_id: number;
  team_name: string;
  founder_id1?: number | null;
  founder_id2?: number | null;
  teamPlayers: {player: MTPlayer}[];
  leagueTeams?: {active: boolean; league: {league_id: number; league_name: string}}[];
};

export function toMTTeam(t: ApiTeam): MTTeam {
  return {
    id: t.team_id,
    name: t.team_name,
    founders: [t.founder_id1, t.founder_id2].filter((id): id is number => id != null),
    players: t.teamPlayers.map((tp) => tp.player),
    leagues: (t.leagueTeams ?? []).map((lt) => ({id: lt.league.league_id, name: lt.league.league_name, active: lt.active})),
  };
}

export function fullName(p: MTPlayer): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

// The list's search looks at the team name and its players' usernames and names
export function filterTeams(teams: MTTeam[], query: string): MTTeam[] {
  return teams.filter((t) => matchesQuery([t.name, ...t.players.flatMap((p) => [p.username, fullName(p)])].join(" "), query));
}

export function teamSubtitle(t: MTTeam): string {
  return t.players.length ? t.players.map((p) => p.username).join(" · ") : "No players yet";
}

export function playerRole(t: {founders: number[]}, playerId: number): "Founder" | "Teammate" {
  return t.founders.includes(playerId) ? "Founder" : "Teammate";
}

export function playerCount(n: number): string {
  return `${n} ${n === 1 ? "player" : "players"}`;
}

// draft: the name field's text, or null while untouched (a new team's empty field shows no error until typed in)
export function teamNameError(draft: string | null, teams: MTTeam[], editingId: number | null): string {
  const name = (draft ?? "").trim();
  if (!name) return draft === null && editingId === null ? "" : "Team name is required.";
  const lower = name.toLowerCase();
  if (teams.some((t) => t.id !== editingId && t.name.trim().toLowerCase() === lower)) return "A team with this name already exists.";
  return "";
}

// The name card's buttons: "Create team" for a new team; "Save name" once the name changed; "Saved" otherwise
export function nameActions(draft: string | null, currentName: string | null, error: string) {
  const isNew = currentName === null;
  const name = (draft ?? currentName ?? "").trim();
  const dirty = !isNew && draft !== null && name !== currentName;
  return {
    dirty,
    canSave: isNew ? !!name && !error : dirty && !error,
    canCancel: isNew || dirty,
    saveLabel: isNew ? "Create team" : dirty ? "Save name" : "Saved",
  };
}
