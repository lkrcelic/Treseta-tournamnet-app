// Section B: every API route × guest, player, organizer and admin on the live server (E2E_PLAN 5.B). The table itself is
// in tests/dozvole/b-dozvole.spec.ts; this is what reads it: who may pass a route's guard (from the capability map,
// _lib/auth/permissions.ts, Bela's DECISIONS #86), what each role gets back, the ids the rows aim at, and the list of
// the app's handlers, so that a new route without a row fails the suite. Bela's helper (Bela f6c8af3) on Treseta's
// world: Treseta's hand tables (OngoingResult, Result) and its places (Lokacije).
import {readdirSync, readFileSync} from "node:fs";
import {join, relative, sep} from "node:path";
import {expect, type APIRequestContext} from "@playwright/test";
import {FORBIDDEN} from "../../src/app/_lib/auth/forbidden";
import {NOT_YOUR_TOURNAMENT} from "../../src/app/_lib/auth/ownership";
import {can, type Capability} from "../../src/app/_lib/auth/permissions";
import {openDb, type Db} from "./db";
import {test as base} from "./fixtures";
import {appInfo, loadWorld, type World} from "./world";

export type Role = "guest" | "player" | "organizer" | "admin";
export const ROLES: readonly Role[] = ["guest", "player", "organizer", "admin"];

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ---------- what a role gets back ----------

// A status, and for a refusal the message that says which check refused (the guard's own, or whose tournament / round
// it is): a 403 from the guard and a 403 from ownership are different findings. Without a message, any text will do.
export type Outcome = {status: number; error?: string};

export const status = (s: number): Outcome => ({status: s});
// requireUser / requireAdmin / requireCan with nobody logged in
export const LOGIN: Outcome = {status: 401, error: "Prijava je istekla. Prijavi se ponovno."};
// requireAdmin / requireCan refusing a role (and refuseUnlessMyTable refusing a league table to a non-admin)
export const DENIED: Outcome = {status: 403, error: FORBIDDEN};
// ownership (refuseUnlessMine, getAdminTournament): a tournament the organizer didn't make
export const NOT_MINE: Outcome = {status: 403, error: NOT_YOUR_TOURNAMENT};
// canPlayRound: only the round's players (or an admin) enter its results and confirm its lineup
export const NOT_MY_ROUND: Outcome = {status: 403, error: "Ne igraš u ovoj rundi."};
export const refused = (s: number, error?: string): Outcome => ({status: s, error});

// A role left out of a row: the request would go through and change the world (a table removed, a match finished),
// and there is no state in which it fails harmlessly. Each SKIP in the table says why.
export const SKIP = "skip" as const;

// The body that fails every route's validation: each route parses an object (or, Završi meč, a number), so a JSON
// array is refused before anything is written (400), whatever the route's fields are
export const INVALID: unknown[] = [];

// ---------- the table's rows ----------

// public: no login; user: requireUser; admin: requireAdmin ("only ADMIN", DECISIONS #86); {can}: requireCan, the map
// decides; cron: the scheduler's Bearer secret, no role at all
export type Guard = "public" | "user" | "admin" | {can: Capability} | "cron";

export type Row = {
  method: Method;
  // the route as the app's folders name it: /api/admin/bans/[id]
  route: string;
  // what the row's test name adds: which piece of the world, and why this one
  note?: string;
  // the route's [params], from the world; `me` is the calling role's own player id (the guest's: the player's)
  params?: (ids: Ids, me: number) => Record<string, string | number>;
  query?: string | ((ids: Ids) => string);
  body?: unknown | ((ids: Ids, me: number) => unknown);
  guard: Guard;
  // what a role the guard lets through gets
  allowed: Outcome;
  // a role whose answer differs from `allowed` once past the guard: ownership, membership, its own profile, or SKIP
  as?: Partial<Record<Role, Outcome | typeof SKIP>>;
  // the app answers this role wrongly: the role gets a test of its own, marked test.fail() with this line (the bug is
  // in the report), and the row's other roles stay an ordinary test
  bug?: {role: Role; text: string};
  // what the row's own requests may change, put back afterwards (a no-op that still writes a column, or a bug's fix)
  keep?: (db: Db, ids: Ids) => Promise<() => Promise<unknown>>;
};

// The guard as the test's name says it: who may get through
export function guardLabel(guard: Guard): string {
  if (guard === "public") return "anyone";
  if (guard === "user") return "logged in";
  if (guard === "admin") return "admin only";
  if (guard === "cron") return "the scheduler only";
  return guard.can;
}

// A no-op write still moves the row's @updatedAt (and a team photo's remover is written down): put them back
export const keepTeam = (team: (ids: Ids) => number) => async (db: Db, ids: Ids) => {
  const id = team(ids);
  const was = await db.team.findUniqueOrThrow({where: {team_id: id}, select: {last_updated_at: true, photo_updated_by: true}});
  return () => db.team.update({where: {team_id: id}, data: was});
};

export const keepPlayer = (player: (ids: Ids) => number) => async (db: Db, ids: Ids) => {
  const id = player(ids);
  const was = await db.player.findUniqueOrThrow({where: {id}, select: {last_updated_at: true}});
  return () => db.player.update({where: {id}, data: was});
};

// Which roles the guard lets through: guest never past a login, the map for a capability
function passes(guard: Guard, role: Role, roleOf: Record<Role, string>): boolean {
  if (guard === "public") return true;
  if (guard === "cron") return false;
  if (role === "guest") return false;
  if (guard === "user") return true;
  if (guard === "admin") return roleOf[role] === "ADMIN";
  return can({player_role: roleOf[role]}, guard.can);
}

export function expected(row: Row, role: Role, roleOf: Record<Role, string>): Outcome | typeof SKIP {
  const through = passes(row.guard, role, roleOf);
  const own = row.as?.[role];
  if (!through) {
    // an exception for a role the guard refuses would be a mistake in the table, not something the app does
    if (own !== undefined) throw new Error(`${row.method} ${row.route}: "${role}" never gets past the guard, its exception means nothing`);
    if (row.guard === "cron") return refused(401, "Nije dopušteno.");
    return role === "guest" ? LOGIN : DENIED;
  }
  return own ?? row.allowed;
}

// How an answer is written down for the comparison: the status, and for an error its message (a 2xx says nothing more)
export function describe(o: Outcome): string {
  return o.error ? `${o.status} ${o.error}` : `${o.status}`;
}

// What the row expects of a role, as a matcher of describe(answer): a refusal by its exact message, any other error
// status with whatever text the route gives
export function matcher(o: Outcome) {
  if (o.error) return describe(o);
  if (o.status >= 400) return expect.stringMatching(new RegExp(`^${o.status}( |$)`));
  return `${o.status}`;
}

export function urlOf(row: Row, ids: Ids, me: number): string {
  const params = row.params?.(ids, me) ?? {};
  const path = row.route.replace(/\[(\w+)\]/g, (_, name: string) => {
    if (!(name in params)) throw new Error(`${row.method} ${row.route}: no value for [${name}]`);
    return encodeURIComponent(String(params[name]));
  });
  const query = typeof row.query === "function" ? row.query(ids) : row.query;
  return query ? `${path}?${query}` : path;
}

// One call as the role, and what came back
export async function call(request: APIRequestContext, row: Row, ids: Ids, me: number): Promise<Outcome> {
  const body = typeof row.body === "function" ? (row.body as (ids: Ids, me: number) => unknown)(ids, me) : row.body;
  const res = await request.fetch(urlOf(row, ids, me), {method: row.method, ...(body !== undefined ? {data: body} : {})});
  const text = await res.text();
  let error: string | undefined;
  if (res.status() >= 400) {
    try {
      const json = JSON.parse(text) as {error?: unknown};
      if (typeof json.error === "string") error = json.error;
    } catch {
      // an image route's empty 404, or a page
    }
  }
  return {status: res.status(), error};
}

// ---------- the world the rows aim at ----------

type Hand = {id: number; table: number};

export type Ids = {
  // each role's own player id; the guest borrows the player's (it never gets past the guard)
  me: Record<Role, number>;
  roleOf: Record<Role, string>;
  league: number;
  night: string;
  // the player's table tonight (playerTonight): published, a match being played, its first hand
  playerTable: {round: number; match: number; hand: number};
  // a table the roles don't play at (tables.correction): a match being played, its first hand
  otherTable: {round: number; match: number; hand: number};
  // a league table played to the end (tables.adminEdit): no match being played
  playedTable: number;
  // a table of tonight's Skica (Novo kolo's draft, not published)
  draftTable: number;
  // a team of the league none of the roles plays in
  otherLeagueTeam: number;
  // finished tournaments: the admin's (Jesenski kup) and the organizer's (Kup bez zvanja), with a table, a hand
  // played at it and a team signed up
  adminTournament: {id: number; table: number; hand: number; team: number};
  ownTournament: {id: number; table: number; hand: number; team: number};
  // the organizer's tournament before its start (Organizatorov kup) and a team signed up to it
  upcomingOwnTournament: {id: number; team: number};
  // the admin's tournament with sign-ups open (Martinje kup) and a team signed up that none of the roles plays in
  openTournament: {id: number; team: number};
  // someone else's ads: open, and closed
  openAd: number;
  closedAd: number;
  liftedBan: number;
  bannedTeam: number;
  // another player (no photo, seen by all), one whose photo everyone may see, and the player (photo for teammates)
  partner: number;
  photoForAll: number;
  photoForTeammates: number;
  // the player's team (no photo, seen by all) and a team whose photo everyone may see
  playerTeam: {id: number; name: string};
  teamPhotoForAll: number;
  sponsor: number;
  // a place of Lokacije that a league and the tournaments use, so it can't be deleted
  placeInUse: number;
};

// an id no table has
export const NONE = 999_999;

async function firstHand(db: Db, matchId: number): Promise<number> {
  const hand = await db.ongoingResult.findFirst({where: {match_id: matchId}, orderBy: {result_id: "asc"}, select: {result_id: true}});
  if (!hand) throw new Error(`match ${matchId} has no hand: reseed with e2e/local/app.sh start b`);
  return hand.result_id;
}

// A finished tournament made by `owner`: one of its tables, a hand played there and a team signed up
async function finishedTournament(db: Db, id: number, owner: number, label: string, roleTeams: number[]) {
  const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}, select: {created_by: true, started_at: true, cancelled_at: true}});
  if (t.created_by !== owner || !t.started_at || t.cancelled_at) throw new Error(`tournament ${id} is no longer ${label} (made by ${t.created_by}): the generator changed`);
  const hand = await db.result.findFirst({
    where: {match: {round: {tournamentRounds: {some: {tournament_id: id}}}}},
    orderBy: {result_id: "asc"},
    select: {result_id: true, match: {select: {round_id: true}}},
  });
  const entry = await db.tournamentTeam.findFirst({where: {tournament_id: id}, orderBy: {team_id: "asc"}, select: {team_id: true}});
  if (!hand?.match.round_id || !entry) throw new Error(`tournament ${id} has no hand played or no team: the generator changed`);
  // the rows count on none of the roles playing there (Tko igra, Jesu li … za stolom?)
  const table = await db.round.findUniqueOrThrow({where: {id: hand.match.round_id}, select: {team1_id: true, team2_id: true}});
  if (roleTeams.includes(table.team1_id) || roleTeams.includes(table.team2_id)) throw new Error(`a role's team plays at table ${hand.match.round_id} of tournament ${id}: the generator changed`);
  return {id, table: hand.match.round_id, hand: hand.result_id, team: entry.team_id};
}

export async function loadIds(db: Db, world: World["catalog"]): Promise<Ids> {
  const a = world.accounts;
  const roleTeams = [...a.player.teams, ...a.organizer.teams, ...a.admin.teams];
  const league = world.leagues.current;
  const night = league.tonight!;

  const playerTonight = world.tables.playerTonight;
  const correction = world.tables.correction;
  // a table without an open match would let firstHand's filter fall away and aim at any match's hand
  if (playerTonight.matchId == null || correction.matchId == null) throw new Error("tables.playerTonight or tables.correction has no open match: the generator changed");
  // GET /api/rounds/open: the player plays at a table now, the organizer and the admin at none
  const openRound = (playerId: number) =>
    db.round.count({
      where: {open: true, status: "PUBLISHED", OR: [{team1: {teamPlayers: {some: {player_id: playerId}}}}, {team2: {teamPlayers: {some: {player_id: playerId}}}}]},
    });
  if (!(await openRound(a.player.id)) || (await openRound(a.organizer.id)) || (await openRound(a.admin.id))) {
    throw new Error("the player plays at no open table, or the organizer or the admin plays at one: the generator changed");
  }
  const draft = await db.round.findFirst({
    where: {status: {not: "PUBLISHED"}, round_date: new Date(night), leagueRounds: {some: {league_id: league.id}}},
    orderBy: {id: "asc"},
    select: {id: true},
  });
  if (!draft) throw new Error(`league ${league.id} has no Skica tonight: reseed with e2e/local/app.sh start b`);
  const otherLeagueTeam = await db.leagueTeam.findFirst({where: {league_id: league.id, team_id: {notIn: roleTeams}}, orderBy: {team_id: "asc"}, select: {team_id: true}});

  const upcoming = world.tournaments.organizer;
  const upcomingRow = await db.tournament.findUniqueOrThrow({where: {tournament_id: upcoming.id}, select: {created_by: true, started_at: true}});
  if (upcomingRow.created_by !== a.organizer.id || upcomingRow.started_at) throw new Error(`tournament ${upcoming.id} is no longer the organizer's, before its start`);
  const upcomingTeam = await db.tournamentTeam.findFirst({where: {tournament_id: upcoming.id, team_id: {notIn: roleTeams}}, orderBy: {registered_at: "desc"}, select: {team_id: true}});
  const open = world.tournaments.open;
  const openTeam = await db.tournamentTeam.findFirst({where: {tournament_id: open.id, team_id: {notIn: roleTeams}}, orderBy: {team_id: "asc"}, select: {team_id: true}});

  const ads = await db.marketPost.findMany({where: {id: {in: [world.ads.partnerOpen.id, world.ads.substituteClosed.id]}}, select: {id: true, player_id: true, closed_at: true}});
  const ad = (id: number) => ads.find((p) => p.id === id);
  const roleIds = [a.player.id, a.organizer.id, a.admin.id];
  for (const p of ads) if (roleIds.includes(p.player_id)) throw new Error(`ad ${p.id} is a role's own: the generator changed`);
  if (!ad(world.ads.substituteClosed.id)?.closed_at) throw new Error("ads.substituteClosed is not closed: the generator changed");

  const photoForAll = await db.player.findFirst({where: {photo_visibility: "ALL", photo: {isNot: null}, active: true, deleted_at: null}, orderBy: {id: "asc"}, select: {id: true}});
  const teamPhotoForAll = await db.team.findFirst({where: {photo_visibility: "ALL", photo: {isNot: null}}, orderBy: {team_id: "asc"}, select: {team_id: true}});
  const player = await db.player.findUniqueOrThrow({where: {id: a.player.id}, select: {photo_visibility: true, photo: {select: {player_id: true}}}});
  if (player.photo_visibility !== "TEAMMATES" || !player.photo) throw new Error("the player's photo is no longer for teammates only: the generator changed");
  const partner = await db.player.findUniqueOrThrow({where: {id: a.partner.id}, select: {photo: {select: {player_id: true}}}});
  if (partner.photo) throw new Error("the partner has a photo now: DELETE /api/players/[id]/photo as the admin would remove it");
  const playerTeam = await db.team.findUniqueOrThrow({where: {team_id: world.teams.player.id}, select: {team_id: true, team_name: true, photo_visibility: true, photo_blocked: true, photo: {select: {team_id: true}}}});
  if (playerTeam.photo || playerTeam.photo_blocked || playerTeam.photo_visibility !== "ALL") throw new Error("the player's team has a photo or its settings changed: the rows that set them to the same value would change it");
  const sponsor = world.sponsors.s1;
  const place = await db.location.findUniqueOrThrow({
    where: {location_id: world.places.pitanik.id},
    select: {location_id: true, _count: {select: {leagues: true, tournaments: true}}},
  });
  if (!place._count.leagues || !place._count.tournaments) throw new Error("places.pitanik is no longer used by a league and the tournaments: the generator changed");
  // Podjela reads a night the league has
  if (!(await db.leagueNight.count({where: {league_id: league.id, night: new Date(night)}}))) throw new Error(`league ${league.id} has no night ${night}: reseed with e2e/local/app.sh start b`);

  if (!photoForAll || !teamPhotoForAll || !otherLeagueTeam || !upcomingTeam || !openTeam) throw new Error("the world lacks a row section B aims at: the generator changed");
  return {
    me: {guest: a.player.id, player: a.player.id, organizer: a.organizer.id, admin: a.admin.id},
    roleOf: {guest: "", player: a.player.role, organizer: a.organizer.role, admin: a.admin.role},
    league: league.id,
    night,
    playerTable: {round: playerTonight.roundId, match: playerTonight.matchId, hand: await firstHand(db, playerTonight.matchId)},
    otherTable: {round: correction.roundId, match: correction.matchId, hand: await firstHand(db, correction.matchId)},
    playedTable: world.tables.adminEdit.roundId,
    draftTable: draft.id,
    otherLeagueTeam: otherLeagueTeam.team_id,
    adminTournament: await finishedTournament(db, world.tournaments.finished.id, a.admin.id, "the admin's, finished", roleTeams),
    ownTournament: await finishedTournament(db, world.tournaments.finishedNoDeclarations.id, a.organizer.id, "the organizer's, finished", roleTeams),
    upcomingOwnTournament: {id: upcoming.id, team: upcomingTeam.team_id},
    openTournament: {id: open.id, team: openTeam.team_id},
    openAd: world.ads.partnerOpen.id,
    closedAd: world.ads.substituteClosed.id,
    liftedBan: world.bans.lifted.id,
    bannedTeam: world.teams.banned.id,
    partner: a.partner.id,
    photoForAll: photoForAll.id,
    photoForTeammates: a.player.id,
    playerTeam: {id: playerTeam.team_id, name: playerTeam.team_name},
    teamPhotoForAll: teamPhotoForAll.team_id,
    sponsor: sponsor.id,
    placeInUse: place.location_id,
  };
}

// The ids once per worker: the rows only read them, so the connection goes back to the shared Postgres at once
export const test = base.extend<{}, {ids: Ids}>({
  ids: [
    async ({}, use) => {
      const app = appInfo();
      const db = openDb(app.databaseUrl);
      let ids: Ids;
      try {
        ids = await loadIds(db, loadWorld(app).catalog);
      } finally {
        await db.$disconnect();
      }
      await use(ids);
    },
    {scope: "worker"},
  ],
});

export {expect};

// ---------- the app's handlers ----------

const API = join(__dirname, "..", "..", "src", "app", "api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return routeFiles(path);
    return e.name === "route.ts" ? [path] : [];
  });
}

// "METHOD /api/route" for every handler the app exports, as adminGuards.test.ts finds them, plus the ones exported in
// one destructuring line (NextAuth's `export const {GET, POST} = handlers`)
export function appHandlers(): string[] {
  return routeFiles(API).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const route = `/api/${relative(API, file).split(sep).slice(0, -1).join("/")}`;
    const named = Array.from(source.matchAll(/^export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/gm)).map((m) => m[1]);
    const destructured = Array.from(source.matchAll(/^export\s+const\s*\{([^}]*)\}\s*=/gm)).flatMap((m) =>
      m[1].split(",").map((s) => s.trim()).filter((s) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(s))
    );
    return [...named, ...destructured].map((method) => `${method} ${route}`);
  });
}
