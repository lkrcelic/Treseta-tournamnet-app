import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {join, relative, sep} from "node:path";
import {test} from "node:test";
import {ADMIN_ACTION_ERROR, adminActionError, AdminTarget, adminCheck} from "../players/admin";
import {PLAYER_NOT_FOUND} from "../../_interfaces/player";

// Handoff §6 "Admin checks": every admin endpoint checks admin rights on the server.

test("adminCheck: logged out is unauthorized, a player is forbidden, an admin may go on", () => {
  assert.equal(adminCheck(null), "unauthorized");
  assert.equal(adminCheck(undefined), "unauthorized");
  assert.equal(adminCheck({player_role: "PLAYER"}), "forbidden");
  assert.equal(adminCheck({player_role: "ADMIN"}), null);
});

const me = {id: 1};
const adminMe: AdminTarget = {id: 1, player_role: "ADMIN", active: true, deleted_at: null};
const player: AdminTarget = {id: 2, player_role: "PLAYER", active: true, deleted_at: null};
const otherAdmin: AdminTarget = {id: 3, player_role: "ADMIN", active: true, deleted_at: null};
const two = {adminCount: 2};
const one = {adminCount: 1};

test("an admin can't deactivate, delete or demote themselves", () => {
  assert.equal(adminActionError(me, adminMe, "deactivate", two), ADMIN_ACTION_ERROR.selfDeactivate);
  assert.equal(adminActionError(me, adminMe, "delete", two), ADMIN_ACTION_ERROR.selfDelete);
  assert.equal(adminActionError(me, adminMe, "demote", two), ADMIN_ACTION_ERROR.selfDemote);
  // but may edit their own details
  assert.equal(adminActionError(me, adminMe, "update", one), null);
  assert.equal(adminActionError(me, adminMe, "activate", one), null);
});

test("the last admin stays an admin", () => {
  assert.equal(adminActionError(me, otherAdmin, "demote", one), ADMIN_ACTION_ERROR.lastAdmin);
  assert.equal(adminActionError(me, otherAdmin, "deactivate", one), ADMIN_ACTION_ERROR.lastAdmin);
  assert.equal(adminActionError(me, otherAdmin, "delete", one), ADMIN_ACTION_ERROR.lastAdmin);
  assert.equal(adminActionError(me, otherAdmin, "demote", two), null);
  assert.equal(adminActionError(me, otherAdmin, "delete", two), null);
  // an inactive admin isn't one of the admins who could take over
  assert.equal(adminActionError(me, {...otherAdmin, active: false}, "delete", one), null);
});

test("an admin may deactivate, activate, delete and edit another player", () => {
  for (const action of ["update", "demote", "deactivate", "activate", "delete"] as const) {
    assert.equal(adminActionError(me, player, action, one), null, action);
  }
  assert.equal(adminActionError(me, {...player, active: false}, "activate", one), null);
});

test("a missing or deleted player can't be changed", () => {
  const deleted = {...player, active: false, deleted_at: new Date("2026-10-12T10:00:00Z")};
  for (const action of ["update", "demote", "deactivate", "activate", "delete"] as const) {
    assert.equal(adminActionError(me, deleted, action, two), PLAYER_NOT_FOUND, action);
    assert.equal(adminActionError(me, null, action, two), PLAYER_NOT_FOUND, action);
  }
});

// --- Static scan of the route handlers -------------------------------------------------------------------------

const API = join(__dirname, "..", "..", "api");
const METHOD = "GET|POST|PUT|PATCH|DELETE";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// "path METHOD" → why it doesn't call requireAdmin: the handlers in the scanned folders that players use too
const ALLOWED_WITHOUT_ADMIN: Record<string, string> = {
  "rounds/[id]/lineup/route.ts PUT": "Tko igra ovu rundu?: a player of either team confirms the lineup (canPlayRound)",
  "matches/route.ts POST": "the players of the round finish their match (canPlayRound)",
};

type Handler = {file: string; method: string; body: string};

function routeFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return routeFiles(path);
    return e.name === "route.ts" ? [path] : [];
  });
}

// Each exported handler, from its `export` to the closing brace at the start of a line or the next `export`,
// whichever comes first (so a one-line handler never borrows the next function's check)
function handlersIn(source: string, file: string): Handler[] {
  const starts = Array.from(source.matchAll(new RegExp(`^export\\s+(?:async\\s+)?(?:function|const)\\s+(${METHOD})\\b`, "gm")));
  const exports = Array.from(source.matchAll(/^export\b/gm)).map((m) => m.index!);
  return starts.map((m) => {
    const close = source.indexOf("\n}", m.index);
    const nextExport = exports.find((i) => i > m.index!);
    const ends = [close === -1 ? source.length : close + 2, nextExport ?? source.length];
    return {file, method: m[1], body: source.slice(m.index, Math.min(...ends))};
  });
}

// `export {handler as POST}` and `export const POST = handler;` would hide the handler's body from handlersIn, so the
// scanned routes must not use them
function reexportsHandler(source: string): boolean {
  return (
    new RegExp(`export\\s*\\{[^}]*\\b(${METHOD})\\b[^}]*\\}`).test(source) ||
    new RegExp(`^export\\s+const\\s+(${METHOD})\\s*=\\s*[\\w$.]+\\s*;?\\s*$`, "m").test(source)
  );
}

function scan(paths: string[]): Handler[] {
  return paths.flatMap((path) => {
    const source = readFileSync(path, "utf8");
    const file = relative(API, path).split(sep).join("/");
    assert.equal(reexportsHandler(source), false, `${file} re-exports a handler; export it as a function`);
    return handlersIn(source, file);
  });
}

function missingAdmin(handlers: Handler[]): string[] {
  return handlers
    .filter((h) => !h.body.includes("requireAdmin("))
    .map((h) => `${h.file} ${h.method}`)
    .filter((key) => !(key in ALLOWED_WITHOUT_ADMIN));
}

test("the scan finds each handler and its own body", () => {
  const source = [
    `import {requireAdmin, requireUser} from "x";`,
    `export async function GET(req) {`,
    `  const auth = await requireUser(req);`,
    `}`,
    ``,
    `export async function POST(req) {`,
    `  const auth = await requireAdmin(req);`,
    `}`,
    `export function DELETE() {`,
    `  return null;`,
    `}`,
  ].join("\n");
  const found = handlersIn(source, "x/route.ts");
  assert.deepEqual(found.map((h) => h.method), ["GET", "POST", "DELETE"]);
  assert.deepEqual(missingAdmin(found), ["x/route.ts GET", "x/route.ts DELETE"]);
  assert.equal(reexportsHandler(`export {handler as POST};`), true);
  assert.equal(reexportsHandler(`export {GET, POST} from "./x";`), true);
  assert.equal(reexportsHandler(`export const GET = list;`), true);
  assert.equal(reexportsHandler(`export {lucia};`), false);
  assert.equal(reexportsHandler(`export const maxDuration = 30;`), false);
});

test("a one-line handler doesn't borrow the next handler's check", () => {
  const source = [
    `export const GET = async () => null;`,
    `export async function POST(req) {`,
    `  const auth = await requireAdmin(req);`,
    `}`,
  ].join("\n");
  assert.deepEqual(missingAdmin(handlersIn(source, "y/route.ts")), ["y/route.ts GET"]);
});

test("every admin endpoint calls requireAdmin", () => {
  // every handler, reads included
  const adminFiles = [
    ...routeFiles(join(API, "admin")),
    join(API, "players", "route.ts"),
    join(API, "session", "route.ts"),
    join(API, "matches", "route.ts"),
  ];
  // the mutations (reads there are for players too); the player ones are in ALLOWED_WITHOUT_ADMIN
  const groups: Record<string, string[]> = {
    teams: routeFiles(join(API, "teams")),
    leagues: routeFiles(join(API, "leagues")),
    rounds: routeFiles(join(API, "rounds")),
    matches: routeFiles(join(API, "matches")),
  };
  // a moved folder must not make this pass with nothing to check
  assert.ok(routeFiles(join(API, "admin")).length > 0, "no routes found under api/admin");
  for (const [name, files] of Object.entries(groups)) assert.ok(files.length > 0, `no routes found under api/${name}`);

  const adminHandlers = scan(adminFiles);
  const mutations = scan(Object.values(groups).flat()).filter((h) => MUTATING.has(h.method));
  assert.ok(adminHandlers.length > 0 && mutations.length > 0);
  assert.deepEqual(missingAdmin([...adminHandlers, ...mutations]), []);
});

test("the allowlist only names handlers that exist", () => {
  const all = scan(routeFiles(API)).map((h) => `${h.file} ${h.method}`);
  for (const key of Object.keys(ALLOWED_WITHOUT_ADMIN)) assert.ok(all.includes(key), `${key} is not a handler`);
});
