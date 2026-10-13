import type {LeagueConferences} from "@/app/_interfaces/league";

// Conferences: groups of a league's teams, each with a name and a color. The color is a dot before the team's name on
// the league's screens, and each conference has its own standings. A league has none, or 2–6.

export type Conference = {id: number; name: string; color: string};

// A team's conference in the league on screen: undefined when the league has no conferences (no dot), null when the
// team has none (a hollow ring, as for the bye)
export type ConferenceOf = (teamId: number) => Conference | null | undefined;

// The colors to pick from. Each reads at least 3.6 : 1 on white, on the cream "my team" row and on the podium tints;
// none is red (the live dot is red and the same size) or navy (the "my team" bar).
export const CONFERENCE_COLORS: readonly {hex: string; name: string}[] = [
  {hex: "#2E6DB4", name: "plava"},
  {hex: "#C2410C", name: "narančasta"},
  {hex: "#0F766E", name: "tirkizna"},
  {hex: "#7A4BA8", name: "ljubičasta"},
  {hex: "#5F7A1F", name: "maslinasta"},
  {hex: "#8B5A2B", name: "smeđa"},
];

export const MIN_CONFERENCES = 2;
export const MAX_CONFERENCES = CONFERENCE_COLORS.length;
export const CONFERENCE_NAME_MAX = 40;

const sameText = (a = "", b = "") => a.trim().toLocaleLowerCase("hr") === b.trim().toLocaleLowerCase("hr");

export function isConferenceColor(hex: string): boolean {
  return CONFERENCE_COLORS.some((c) => c.hex === hex.toUpperCase());
}

export function colorName(hex: string): string {
  return CONFERENCE_COLORS.find((c) => c.hex === hex.toUpperCase())?.name ?? hex;
}

// Why a league's conferences can't be saved as listed, or null when they can: none at all, or 2–6, each with a name
// and a color from the palette, no two with the same name (in any case) or the same color. (The fields are optional
// because that is how zod's request types come out without strict null checks.)
export function conferencesError(list: readonly {name?: string; color?: string}[]): string | null {
  if (list.length === 0) return null;
  const names = list.map((c) => (c.name ?? "").trim());
  const colors = list.map((c) => (c.color ?? "").toUpperCase());
  if (list.length < MIN_CONFERENCES) return `Liga treba barem ${MIN_CONFERENCES} konferencije ili nijednu.`;
  if (list.length > MAX_CONFERENCES) return `Liga može imati najviše ${MAX_CONFERENCES} konferencija.`;
  if (names.some((n) => !n)) return "Svaka konferencija treba ime.";
  if (names.some((n) => n.length > CONFERENCE_NAME_MAX)) return `Ime konferencije može imati najviše ${CONFERENCE_NAME_MAX} znakova.`;
  if (names.some((n, i) => names.findIndex((m) => sameText(n, m)) !== i)) return "Dvije konferencije ne mogu imati isto ime.";
  if (colors.some((c) => !isConferenceColor(c))) return "Svakoj konferenciji odaberi boju iz palete.";
  if (colors.some((c, i) => colors.indexOf(c) !== i)) return "Dvije konferencije ne mogu imati istu boju.";
  return null;
}

// The first palette color not taken yet (for a new row in the editor)
export function nextFreeColor(taken: readonly string[]): string {
  const used = new Set(taken.map((c) => c.toUpperCase()));
  return (CONFERENCE_COLORS.find((c) => !used.has(c.hex)) ?? CONFERENCE_COLORS[0]).hex;
}

export type ConferenceLookup = {
  // in the league's order; empty when the league has none
  conferences: Conference[];
  of: ConferenceOf;
};

export const NO_CONFERENCES: ConferenceLookup = {conferences: [], of: () => undefined};

// What a team's dot shows: its conference's color, null for a hollow ring (no conference), undefined for no dot (the
// league has no conferences)
export function conferenceDot(conference: Conference | null | undefined): string | null | undefined {
  return conference === undefined ? undefined : conference?.color ?? null;
}

// The lookup the screens use, from GET /api/leagues/[id]/conferences
export function conferenceLookup(data: LeagueConferences | null | undefined): ConferenceLookup {
  if (!data || data.conferences.length === 0) return NO_CONFERENCES;
  const conferences = data.conferences.map((c) => ({id: c.conference_id, name: c.name, color: c.color}));
  const byId = new Map(conferences.map((c) => [c.id, c]));
  const byTeam = new Map(data.teams.map((t) => [t.team_id, byId.get(t.conference_id) ?? null]));
  return {conferences, of: (teamId) => byTeam.get(teamId) ?? null};
}

// Create Round with "Only within conferences": tonight's teams by conference, in the league's order of conferences;
// the teams without one make a group of their own, last
export function conferenceGroups<T extends {id: number}>(teams: readonly T[], lookup: ConferenceLookup): {name: string; teams: T[]}[] {
  const groups = lookup.conferences.map((c) => ({name: c.name, teams: teams.filter((t) => lookup.of(t.id)?.id === c.id)}));
  const none = teams.filter((t) => !lookup.of(t.id));
  return none.length ? [...groups, {name: "Ekipe bez konferencije", teams: none}] : groups;
}

// "Distribute evenly" in Manage League: deals the teams, in table order, to the conferences in snake order (A B C C B A
// A B C …), so each conference gets the same number of teams (one more at most) and a similar share of the table
export function distributeEvenly(teamIds: readonly number[], conferenceIds: readonly number[]): {team_id: number; conference_id: number}[] {
  const n = conferenceIds.length;
  if (n === 0) return [];
  return teamIds.map((team_id, i) => {
    const lap = Math.floor(i / n);
    const k = i % n;
    return {team_id, conference_id: conferenceIds[lap % 2 === 0 ? k : n - 1 - k]};
  });
}
