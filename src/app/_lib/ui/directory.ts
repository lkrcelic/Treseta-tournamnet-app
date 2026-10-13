// The admin's Ekipe and Igrači directories (handoff §6 "Desktop admin", design 13h, 13j) and the options of the Team
// page's search-and-add fields. Framework free so they can be unit tested.
import type {AdminPlayerRow} from "@/app/_interfaces/player";
import {TEAM_NAME_REQUIRED, TEAM_NAME_TAKEN} from "@/app/_interfaces/team";
import {leagueEnded} from "@/app/_lib/league";
import {displayName, fullName} from "@/app/_lib/players/names";
import {seasonLabel, teamSubline} from "@/app/_lib/ui/profiles";
import {matchesQuery} from "@/app/_lib/ui/text";

// ---------- the lists ----------

export type DirectoryMember = {id: number; first_name: string; last_name: string; username?: string};
export type DirectoryLeague = {id: number; name: string};
export type DirectoryTeam = {id: number; name: string; players: DirectoryMember[]; leagues: DirectoryLeague[]};

// a team as GET /api/teams sends it (an admin gets the usernames)
type ApiTeam = {
  team_id: number;
  team_name: string;
  teamPlayers: {player: DirectoryMember}[];
  leagueTeams?: {league: {league_id: number; league_name: string}}[];
};

export function toDirectoryTeam(t: ApiTeam): DirectoryTeam {
  return {
    id: t.team_id,
    name: t.team_name,
    players: t.teamPlayers.map((tp) => tp.player),
    leagues: (t.leagueTeams ?? []).map((lt) => ({id: lt.league.league_id, name: lt.league.league_name})),
  };
}

// In Croatian alphabetical order (č after c, đ after d, lj and nj as two letters), as every list of names in the app
export function sortHr<T>(list: readonly T[], name: (item: T) => string): T[] {
  return [...list].sort((a, b) => name(a).localeCompare(name(b), "hr"));
}

// Traži ekipe: the team's name and its players' names and usernames (Admin upute: "a team is found by a player's name
// too")
export function filterTeams(teams: DirectoryTeam[], query: string): DirectoryTeam[] {
  return teams.filter((t) => matchesQuery([t.name, ...t.players.flatMap((p) => [fullName(p), p.username ?? ""])].join(" "), query));
}

// Traži igrače: the name and the username
export function filterPlayers(players: AdminPlayerRow[], query: string): AdminPlayerRow[] {
  return players.filter((p) => matchesQuery(`${p.name} ${p.username}`, query));
}

// A directory row's second line: "3 igrača · 2 lige" for a team; "@iperic · Dalmatinci" for a player (all their teams;
// only the username for a player in none)
export function teamDirectorySub(t: DirectoryTeam): string {
  return teamSubline(t.players.length, t.leagues.length);
}

export function playerDirectorySub(p: Pick<AdminPlayerRow, "username" | "teams">): string {
  const teams = p.teams.map((t) => t.team_name).join(", ");
  return teams ? `@${p.username} · ${teams}` : `@${p.username}`;
}

// The directory shows a page of rows at a time ("Učitaj još")
export const DIRECTORY_PAGE = 12;

// How many pages to show: the ones asked for, or, when the selected row lies beyond them (a team opened from elsewhere),
// enough that it is shown with at least half a page after it, so the list doesn't seem to end at it
export function directoryPages(pages: number, selectedIndex: number, size = DIRECTORY_PAGE): number {
  if (selectedIndex < pages * size) return pages;
  return Math.floor((selectedIndex + Math.ceil(size / 2)) / size) + 1;
}

export function directoryPage<T>(list: readonly T[], pages: number, size = DIRECTORY_PAGE): {shown: T[]; left: number} {
  const shown = list.slice(0, size * pages);
  return {shown, left: list.length - shown.length};
}

// ---------- the search-and-add options (Team page, admin) ----------

export type AddOptionData = {id: number; name: string; sub?: string; search?: string};

// Dodaj igrača: the active players who aren't in the team yet, found by name or username
export function playerAddOptions(players: AdminPlayerRow[], rosterIds: Iterable<number>): AddOptionData[] {
  const roster = new Set(rosterIds);
  return players
    .filter((p) => p.active && !roster.has(p.id))
    .map((p) => ({id: p.id, name: p.name, sub: playerDirectorySub(p), search: `${p.name} ${p.username}`}));
}

export type LeagueFacts = {id: number; name: string; season?: string | null; endDate?: string | null; lastNight?: string | null};

// A league's hit: "Jesen 2026 · U tijeku", only the season once it has ended, "U tijeku" for a running league without
// a season (design 13h, P:441)
export function leagueOptionSub(l: LeagueFacts, today: string): string | undefined {
  const live = !leagueEnded(l.endDate ?? null, l.lastNight ?? null, today);
  return [seasonLabel(l.season), live ? "U tijeku" : null].filter(Boolean).join(" · ") || undefined;
}

// Dodaj u ligu: the leagues the team isn't in, running ones first, then the newest
export function leagueAddOptions(leagues: LeagueFacts[], joinedIds: Iterable<number>, today: string): AddOptionData[] {
  const joined = new Set(joinedIds);
  return leagues
    .filter((l) => !joined.has(l.id))
    .map((l) => ({l, live: !leagueEnded(l.endDate ?? null, l.lastNight ?? null, today)}))
    .sort((a, b) => Number(b.live) - Number(a.live) || b.l.id - a.l.id)
    .map(({l}) => ({id: l.id, name: l.name, sub: leagueOptionSub(l, today)}));
}

// ---------- keeping the lists in step with a change on a Team page ----------

export function renameTeamIn(teams: DirectoryTeam[], teamId: number, name: string): DirectoryTeam[] {
  return teams.map((t) => (t.id === teamId ? {...t, name} : t));
}

export function addTeamMember(teams: DirectoryTeam[], teamId: number, player: DirectoryMember): DirectoryTeam[] {
  return teams.map((t) =>
    t.id === teamId && !t.players.some((p) => p.id === player.id) ? {...t, players: sortHr([...t.players, player], (p) => displayName(p))} : t
  );
}

export function removeTeamMember(teams: DirectoryTeam[], teamId: number, playerId: number): DirectoryTeam[] {
  return teams.map((t) => (t.id === teamId ? {...t, players: t.players.filter((p) => p.id !== playerId)} : t));
}

export function addTeamLeague(teams: DirectoryTeam[], teamId: number, league: DirectoryLeague): DirectoryTeam[] {
  return teams.map((t) => (t.id === teamId && !t.leagues.some((l) => l.id === league.id) ? {...t, leagues: [league, ...t.leagues]} : t));
}

export function addPlayerTeam(players: AdminPlayerRow[], playerId: number, team: {team_id: number; team_name: string}): AdminPlayerRow[] {
  return players.map((p) =>
    p.id === playerId && !p.teams.some((t) => t.team_id === team.team_id) ? {...p, teams: sortHr([...p.teams, team], (t) => t.team_name)} : p
  );
}

export function removePlayerTeam(players: AdminPlayerRow[], playerId: number, teamId: number): AdminPlayerRow[] {
  return players.map((p) => (p.id === playerId ? {...p, teams: p.teams.filter((t) => t.team_id !== teamId)} : p));
}

export function renamePlayersTeam(players: AdminPlayerRow[], teamId: number, name: string): AdminPlayerRow[] {
  return players.map((p) =>
    p.teams.some((t) => t.team_id === teamId)
      ? {...p, teams: sortHr(p.teams.map((t) => (t.team_id === teamId ? {...t, team_name: name} : t)), (t) => t.team_name)}
      : p
  );
}

// ---------- the team's name (the pencil on a Team page, "Nova ekipa") ----------

// What is wrong with a name before it is sent: empty, or another team's name (ignoring case); "" when it can go
export function teamNameError(name: string, teams: readonly {id: number; name: string}[] | null, exceptId: number | null): string {
  const clean = name.trim();
  if (!clean) return TEAM_NAME_REQUIRED;
  const lower = clean.toLocaleLowerCase("hr");
  if (teams?.some((t) => t.id !== exceptId && t.name.trim().toLocaleLowerCase("hr") === lower)) return TEAM_NAME_TAKEN;
  return "";
}
