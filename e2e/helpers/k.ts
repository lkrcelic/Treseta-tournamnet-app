// K's own setup (conferences; Treseta only, BELA_SYNC.md · Conferences). The generated world has no conferences, so each
// test gets a league of its own, "E2E · Konferencije": eight teams of two players, all made for the test and removed
// with everything they played afterwards (and before, if a run was cut short), so --repeat-each starts from the same
// point. Tonight is its only night and it has no start time, so there is no Tu smo: every active team plays. Its
// Ukupni poredak has a known order (Bura first … Garbin last). The league starts without conferences; addConferences
// and publishKolo add them and tonight's Kolo through the admin's routes, as Upravljanje ligom and Novo kolo do.
import {expect, type APIRequestContext, type Locator, type Page} from "@playwright/test";
import {leagueNightString} from "@/app/_lib/dates";
import type {Db} from "./db";
import {test as base} from "./fixtures";

export const LEAGUE_NAME = "E2E · Konferencije";
const USERNAME_PREFIX = "e2e.k.";

// The palette (docs/arhiva/CONFERENCES_PLAN.md, D4): the colors the tests use, with their names in the editor
export const COLORS = {plava: "#2E6DB4", narančasta: "#C2410C", tirkizna: "#0F766E"} as const;

// Croatian winds, in the order of the league's table: rank 1 has 16 points, rank 8 has 2. Two players each.
const TEAMS: [string, [string, string], [string, string]][] = [
  ["Bura", ["Ante", "Bilić"], ["Mate", "Šarić"]],
  ["Tramuntana", ["Ivana", "Kovač"], ["Luka", "Perić"]],
  ["Levant", ["Duje", "Grgić"], ["Petra", "Jukić"]],
  ["Maestral", ["Šime", "Radić"], ["Tea", "Barišić"]],
  ["Lebić", ["Frane", "Mandić"], ["Ema", "Klarić"]],
  ["Oštro", ["Jure", "Ćosić"], ["Nika", "Šimić"]],
  ["Pulenat", ["Roko", "Zorić"], ["Dora", "Čović"]],
  ["Garbin", ["Toni", "Galić"], ["Lana", "Bašić"]],
];

export type KTeam = {id: number; name: string; rank: number; players: {id: number; username: string}[]};

export type Liga = {
  id: number;
  name: string;
  // tonight's league night, YYYY-MM-DD
  night: string;
  // in the order of Ukupni poredak
  teams: KTeam[];
  // a player of the first team (Bura) who logs in; every K player opens Početna without an onboarding sheet
  phone: string;
  // the admin's request context, for setup through the app's routes
  admin: APIRequestContext;
};

export type Conference = {id: number; name: string; color: string};

export type Conferences = {
  sjever: Conference;
  jug: Conference;
  // a team's conference (every team has one once assigned)
  of: (team: KTeam) => Conference;
};

const ascii = (s: string) =>
  s
    .toLowerCase()
    .replace(/č|ć/g, "c")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/[^a-z0-9]/g, "");

// Everything of K's league: the league (its conferences, nights, drafts and standings go with it), the teams of K's own
// players (their rounds, as team1 or team2, go with them) and the players
async function removeLiga(db: Db) {
  await db.league.deleteMany({where: {league_name: LEAGUE_NAME}});
  await db.team.deleteMany({
    where: {team_name: {in: TEAMS.map(([name]) => name)}, teamPlayers: {some: {player: {username: {startsWith: USERNAME_PREFIX}}}}},
  });
  await db.player.deleteMany({where: {username: {startsWith: USERNAME_PREFIX}}});
}

export const test = base.extend<{liga: Liga}>({
  liga: async ({api, db}, use) => {
    await removeLiga(db);
    const admin = await api("admin");
    // every generated account takes the same password (fixtures.ts PASSWORD): borrow its hash
    const {password_hash} = await db.player.findUniqueOrThrow({where: {username: "admin"}, select: {password_hash: true}});
    const teams: KTeam[] = [];
    for (const [rank, [name, ...people]] of TEAMS.entries()) {
      const players = [];
      for (const [i, [first_name, last_name]] of people.entries()) {
        const username = `${USERNAME_PREFIX}${ascii(name)}.${i + 1}`;
        const p = await db.player.create({
          data: {
            username,
            email: `${username}@e2e.test`,
            password_hash,
            player_role: "PLAYER",
            first_name,
            last_name,
            birth_date: new Date(`19${70 + rank * 3 + i}-05-1${i}T00:00:00.000Z`),
            smoker_answered: true,
          },
        });
        players.push({id: p.id, username});
      }
      const team = await db.team.create({data: {team_name: name, teamPlayers: {create: players.map((p) => ({player_id: p.id}))}}});
      teams.push({id: team.team_id, name, rank: rank + 1, players});
    }
    const night = leagueNightString();
    // Nova liga as the admin sends it: the teams and tonight, one Kolo a night
    const created = await admin.post("/api/leagues", {
      data: {league_name: LEAGUE_NAME, team_ids: teams.map((t) => t.id), nights: [night], rounds_per_night: 1},
    });
    expect(created.status(), `Nova liga: ${await created.text()}`).toBe(201);
    const {league_id} = (await created.json()) as {league_id: number};
    // the season so far: Bura 8 wins of 8 … Garbin 1, so the table's order is known (points, then difference)
    await db.teamScore.createMany({
      data: teams.map((t, i) => ({
        team_id: t.id,
        league_id,
        rounds_played: 8,
        wins: 8 - i,
        losses: i,
        score: 2 * (8 - i),
        point_difference: 120 - 30 * i,
      })),
    });
    await use({id: league_id, name: LEAGUE_NAME, night, teams, phone: teams[0].players[0].username, admin});
    await removeLiga(db);
  },
});

export {expect};
export {escape} from "./scorepad";

// Ranks of the table as Rasporedi ravnomjerno deals them to two conferences (snake order: 1 → A, 2 → B, 3 → B, 4 → A …)
export const SNAKE = {first: [1, 4, 5, 8], second: [2, 3, 6, 7]} as const;

// Sjever (plava) and Jug (tirkizna), saved as Upravljanje ligom · Podaci saves them; with `assign`, the teams dealt out
// as Rasporedi ravnomjerno deals them (Sjever: ranks 1, 4, 5, 8; Jug: 2, 3, 6, 7)
export async function addConferences(liga: Liga, {assign = true} = {}): Promise<Conferences> {
  const saved = await liga.admin.put(`/api/leagues/${liga.id}/conferences`, {
    data: {conferences: [{name: "Sjever", color: COLORS.plava}, {name: "Jug", color: COLORS.tirkizna}]},
  });
  expect(saved.ok(), `conferences: ${await saved.text()}`).toBeTruthy();
  const {conferences} = (await saved.json()) as {conferences: {conference_id: number; name: string; color: string}[]};
  const [sjever, jug] = conferences.map((c) => ({id: c.conference_id, name: c.name, color: c.color}));
  const of = (team: KTeam) => ((SNAKE.first as readonly number[]).includes(team.rank) ? sjever : jug);
  if (assign) {
    const teams = await liga.admin.put(`/api/leagues/${liga.id}/conferences/teams`, {
      data: {teams: liga.teams.map((t) => ({team_id: t.id, conference_id: of(t).id}))},
    });
    expect(teams.ok(), `teams' conferences: ${await teams.text()}`).toBeTruthy();
  }
  return {sjever, jug, of};
}

export type KTable = {roundId: number; roundNumber: number; tableNumber: number; status: string; team1: number; team2: number};

// Tonight's tables of K's league, by table number
export async function tonightTables(db: Db, liga: Liga): Promise<KTable[]> {
  const rounds = await db.round.findMany({
    where: {leagueRounds: {some: {league_id: liga.id}}, round_date: new Date(liga.night)},
    orderBy: [{round_number: "asc"}, {table_number: "asc"}],
  });
  return rounds.map((r) => ({roundId: r.id, roundNumber: r.round_number!, tableNumber: r.table_number!, status: r.status, team1: r.team1_id, team2: r.team2_id}));
}

// Tonight's Kolo for every team, made as the admin makes it (Novo kolo's pairing without "Samo unutar konferencija",
// Odobri sva, Objavi); returns its tables
export async function publishKolo(liga: Liga, db: Db): Promise<KTable[]> {
  const created = await liga.admin.post("/api/rounds/generate-multiple", {
    data: {league_id: liga.id, present_teams: liga.teams.map((t) => t.id), numberOfRounds: 1, windowSize: 8, allowRepeats: true},
  });
  expect(created.status(), `Novo kolo: ${await created.text()}`).toBe(201);
  for (const step of ["approve", "publish"]) {
    const res = await liga.admin.post(`/api/leagues/${liga.id}/nights/${liga.night}/${step}`);
    expect(res.ok(), `${step}: ${await res.text()}`).toBeTruthy();
  }
  const tables = await tonightTables(db, liga);
  expect(tables.map((t) => t.status)).toEqual(tables.map(() => "PUBLISHED"));
  return tables;
}

// "#2E6DB4" → "rgb(46, 109, 180)", as the browser reports a background color
export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// The team's dot inside `scope` (a standings row, a table, a card): one dot, named after its conference (screen
// readers hear the name) and filled with its color
export async function expectDot(scope: Locator, conference: Conference) {
  const dots = scope.getByRole("img");
  await expect(dots).toHaveCount(1);
  await expect(dots).toHaveAccessibleName(conference.name);
  await expect(dots).toHaveCSS("background-color", rgb(conference.color));
}

// A standings row (Ukupni poredak, Dnevni poredak's Tablica okupljanja) of a logged-in viewer: the list item with the
// team's link
export function standingsRow(list: Locator, page: Page, team: string): Locator {
  return list.getByRole("listitem").filter({has: page.getByRole("link", {name: team, exact: true})});
}
