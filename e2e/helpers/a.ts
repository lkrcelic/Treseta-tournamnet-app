// Section A: every page of the app (src/app/**/page.tsx) as a guest, a player, an organizer and an admin, on the
// phone and on the computer. One table, PAGES: a line per page (a route, with a world id for its dynamic parts) and
// what each role sees there. definePages() makes one test per line and role; a new page is one more line.
//
// Bela's section A (Bela f6c8af3) on Treseta: Treseta's pages (Lokacije, the hand's two steps Zvanja and Igra, the
// conference and Podjela views of Upravljanje ligom, a tournament's Kolo with Vrati stol, Uredi ishod and Vrijeme kola),
// its world (the "na prolaz" tournament where Bela has the one with hidden sign-ups) and its guest: without Bela's Gost
// i poziv (BELA_SYNC.md · Not copied) a guest has no Početna, the league's season table is public, and only Burza's
// pages send a guest to Prijava with ?next=.
//
// Each test opens the page in a fresh logged-in context and checks that
//   - it lands where it should: the page itself, or where it sends that role (a guest to Prijava, a player to Početna
//     or into their own game, the admin to Tko igra …),
//   - what the role should see is there (the page's heading, or its refusal: "Nemaš ovlasti za ovu radnju.", "Ovo
//     nije tvoj turnir.", "Ovo se uređuje na računalu.", "Ne igraš u ovoj rundi."); where DECISIONS doesn't say
//     how a page refuses a role, either a forward elsewhere or one of those refusals will do (REFUSED),
//   - and once it settled, the page is healthy (helpers/health.ts: no 5xx, no console or page error, no horizontal
//     scroll, no undefined / NaN / Invalid Date, no error screen, nothing that didn't load) and isn't "Stranica ne
//     postoji" unless that is the point.
// The time until the page showed what it should is recorded per test (annotation "vrijeme") and the 10 slowest are
// printed after each spec file: information only, never a failure.
//
// What each role should see comes from the app's own words: permissions.ts (DECISIONS #86: an organizer runs their
// own tournaments, makes and edits teams, sees the Igrači directory, and nothing of the league), the pages' comments
// (Sponzori, Ekipe and Igrači send whoever may not to Početna, DECISIONS #46; an admin screen on the phone tells
// anyone who doesn't manage it "Ovo se uređuje na računalu.", #36; a table is the admin's scorepad, Pregled stola
// for anyone else and the game for its own players, #60), publicPaths.ts (what a guest may open) and middleware.ts (a
// guest is sent to Prijava, which comes back with ?next= from Burza only).
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import type {Page, TestInfo} from "@playwright/test";
import type {Db} from "./db";
import {expect, test} from "./fixtures";
import {loadWorld, type App, type World} from "./world";

export const ROLES = ["guest", "player", "organizer", "admin"] as const;
export type Role = (typeof ROLES)[number];
export type Device = "phone" | "desktop";

// ---------- what the world gives the table ----------

export type Ids = {
  // the current league ("Trešeta liga Jesen 2026") and tonight as its Dnevni poredak names it ("17.11.2026")
  league: number;
  night: string;
  // the leagues whose latest published night is the latest of all: "the league being played now" is one of them
  playedNow: number[];
  // the player's own table tonight (tables.playerTonight): its round, its number, its open match and its first hand
  table: {roundId: number; number: number; matchId: number; handId: number};
  // a table of tonight's current league with both matches played (Kraj kola)
  finishedTable: number;
  // a table nobody at it has started yet, none of our accounts' (tables.handEntry): Tko igra
  otherTable: number;
  // the live tournament's table being played (tournaments.live) and its number
  tournamentTable: {roundId: number; number: number};
  // the live tournament's Kolo being played, with its no-show table and its awarded win (Vrati stol, Uredi ishod)
  liveKolo: number;
  player: {id: number; name: string};
  team: {id: number; name: string};
  // first names, for the desktop Početna's "Dobrodošao, …"
  firstName: Record<Exclude<Role, "guest">, string>;
  ads: {open: number; closed: number};
  // Treseta's world has the "na prolaz" tournament where Bela's has the one with hidden sign-ups
  tournaments: Record<"live" | "finished" | "open" | "naProlaz" | "cancelled" | "organizer", {id: number; name: string}>;
};

// The ids are read from the database once per seeded world and kept next to its manifest, so the tests don't open a
// connection each: the suite's Postgres is shared by every section (and Treseta's), and its 100 connections run out.
export async function idsOf(app: App, db: Db): Promise<Ids> {
  const {now, catalog: world} = loadWorld(app);
  const file = join(dirname(app.manifest), "a-ids.json");
  if (existsSync(file)) {
    const kept = JSON.parse(readFileSync(file, "utf8")) as {now: string; ids: Ids};
    if (kept.now === now) return kept.ids;
  }
  let ids: Ids | undefined;
  // setup only: a moment when the shared Postgres has no free connection is waited out, never the page under test
  await expect(async () => {
    ids = await readIds(world, db);
  }, "the world's ids from the database").toPass({timeout: 60_000});
  writeFileSync(file, JSON.stringify({now, ids}));
  return ids!;
}

// one query after another, so one connection does
async function readIds(world: World["catalog"], db: Db): Promise<Ids> {
  const {current} = world.leagues;
  const tonight = current.tonight!;
  const playerTable = world.tables.playerTonight;
  const tableRound = await db.round.findUniqueOrThrow({where: {id: playerTable.roundId}});
  const hand = await db.ongoingResult.findFirstOrThrow({where: {match_id: playerTable.matchId!}, orderBy: {result_id: "asc"}});
  const finished = await db.round.findFirstOrThrow({
    where: {leagueRounds: {some: {league_id: current.id}}, round_date: new Date(tonight), status: "PUBLISHED", matches: {some: {}}, ongoingMatches: {none: {}}},
    orderBy: [{round_number: "asc"}, {id: "asc"}],
  });
  const tournamentMatch = await db.ongoingMatch.findFirstOrThrow({
    where: {round: {tournamentRounds: {some: {tournament_id: world.tournaments.live.id}}}},
    include: {round: true},
    orderBy: {id: "asc"},
  });
  const liveKolo = await db.round.aggregate({
    _max: {round_number: true},
    where: {tournamentRounds: {some: {tournament_id: world.tournaments.live.id}}, status: "PUBLISHED"},
  });
  const people = await db.player.findMany({where: {id: {in: [world.accounts.player.id, world.accounts.organizer.id, world.accounts.admin.id]}}});
  const played = await db.$queryRaw<{league_id: number; night: Date}[]>`
      SELECT lr.league_id, MAX(r.round_date) AS night
      FROM "LeagueRound" lr JOIN "Round" r ON r.id = lr.round_id
      WHERE r.status = 'PUBLISHED'
      GROUP BY lr.league_id`;
  await db.$disconnect();
  const person = (id: number) => people.find((p) => p.id === id)!;
  const latest = Math.max(...played.map((p) => p.night.getTime()));
  const [y, m, d] = tonight.split("-");
  const t = world.tournaments;
  return {
    league: current.id,
    night: `${d}.${m}.${y}`,
    playedNow: played.filter((p) => p.night.getTime() === latest).map((p) => p.league_id),
    table: {roundId: playerTable.roundId, number: tableRound.table_number!, matchId: playerTable.matchId!, handId: hand.result_id},
    finishedTable: finished.id,
    otherTable: world.tables.handEntry.roundId,
    tournamentTable: {roundId: tournamentMatch.round!.id, number: tournamentMatch.round!.table_number!},
    liveKolo: liveKolo._max.round_number!,
    player: {id: world.accounts.player.id, name: `${person(world.accounts.player.id).first_name} ${person(world.accounts.player.id).last_name}`},
    team: world.teams.player,
    firstName: {
      player: person(world.accounts.player.id).first_name!,
      organizer: person(world.accounts.organizer.id).first_name!,
      admin: person(world.accounts.admin.id).first_name!,
    },
    ads: {open: world.ads.substituteTonight.id, closed: world.ads.partnerClosed.id},
    tournaments: {live: t.live, finished: t.finished, open: t.open, naProlaz: t.naProlaz, cancelled: t.cancelled, organizer: t.organizer},
  };
}

// ---------- what a role sees ----------

type Seen = string | RegExp | ((ids: Ids) => string | RegExp);
// what is on screen once the page is there: an element by its role and name, or a text
type AriaRole = Parameters<Page["getByRole"]>[0];
// hidden: the element may sit under a modal sheet (the phone's Prijava always offers the install sheet over itself,
// installSnooze.ts), which takes the rest of the page out of the accessibility tree while it is still on screen
export type Look = {role: AriaRole; name: Seen; hidden?: true} | {text: Seen};

export type Outcome = {
  // what the test name says the role gets ("opens", "→ Početna", 'says "Ovo nije tvoj turnir."')
  title: string;
  // where the page ends up (path and query); the page's own path, with any query, when left out
  at?: (ids: Ids, path: string) => RegExp;
  // what is on screen there (all of them, when a list); a refusal (`refused`) needs none
  look?: Look | Look[];
  // the role may not open the page, and the app hasn't settled how it refuses: it sends them elsewhere or says so in
  // one of its refusals (REFUSALS), either will do
  refused?: true;
  // a known bug in the app: the test stays as it should be and is marked test.fail with this line
  bug?: string;
};
// a guest on a page that needs a login: Prijava, coming back to the page afterwards (pageGate.ts loginUrl)
type Login = "login";
// sent to Početna: what "/" shows that role on that device
type Home = "home";
type One = Outcome | Login | Home;
export type Expect = One | {phone: One; desktop: One};

export type Row = {
  // the page's route (src/app/<route>/page.tsx) and, for a second line of the same route, which state it shows
  route: string;
  path: (ids: Ids) => string;
  // a page a guest may open (publicPaths.ts): the guest sees what `all` says
  public?: boolean;
  guest?: Expect;
  // the same for every logged-in role, unless a role has its own
  all?: Expect;
  player?: Expect;
  organizer?: Expect;
  admin?: Expect;
};

// how the app refuses: every refusal from the server (src/app/_lib/auth/forbidden.ts FORBIDDEN), an organizer on a
// tournament that isn't theirs (ownership.ts), a table's own players only (requireUser.ts notYourRoundResponse), and
// an admin screen on the phone for whoever doesn't manage it (DesktopOnlyNote)
const NO_RIGHT = "Nemaš ovlasti za ovu radnju.";
const NOT_YOURS = "Ovo nije tvoj turnir.";
const NOT_YOUR_ROUND = "Ne igraš u ovoj rundi.";
const DESKTOP_ONLY = "Ovo se uređuje na računalu.";
const REFUSALS = [NO_RIGHT, NOT_YOURS, NOT_YOUR_ROUND, DESKTOP_ONLY];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// the page opens and shows this heading or button
export const h = (name: Seen, title = "opens"): Outcome => ({title, look: {role: "heading", name}});
export const button = (name: Seen, title = "opens"): Outcome => ({title, look: {role: "button", name}});
export const shows = (look: Look | Look[]): Outcome => ({title: "opens", look});
export const per = (phone: One, desktop: One): Expect => ({phone, desktop});
// forwarded to another address: `to` names it for the test's name
export const at = (to: string, where: (ids: Ids) => RegExp, outcome: Outcome): Outcome => ({
  ...outcome,
  title: outcome.title === "opens" ? `→ ${to}` : `→ ${to}, ${outcome.title}`,
  at: (ids) => where(ids),
});
// refused on the page itself, in these words
export const says = (text: string): Outcome => ({title: `says "${text}"`, look: {text}});
export const desktopOnly: Outcome = h(DESKTOP_ONLY, `says "${DESKTOP_ONLY}"`);
export const notFound: Outcome = h("Stranica ne postoji", 'says "Stranica ne postoji"');
// redirects or says so, the way the brief puts it, where DECISIONS doesn't say which
export const REFUSED: Outcome = {title: "is refused (sent elsewhere or told why)", refused: true};
export const bug = (line: string, outcome: Outcome): Outcome => ({...outcome, bug: line});
// Prijava's heading (Bela's phone has the install sheet over it, which Treseta's tests keep away; hidden stays harmless)
const PRIJAVA: Look = {role: "heading", name: "Prijava", hidden: true};

function expectOf(row: Row, role: Role): Expect {
  if (role === "guest") return row.guest ?? (row.public ? row.all! : "login");
  return row[role] ?? row.all!;
}

function oneOf(e: Expect, device: Device): One {
  return typeof e === "object" && "phone" in e ? e[device] : e;
}

// ---------- the tests ----------

type Timing = {project: string; test: string; path: string; ready: number; server: number};

// The tests of PAGES for one project: `mobitel` (a-stranice.spec.ts) or `racunalo` (a-stranice.racunalo.spec.ts)
export function definePages(rows: Row[], device: Device) {
  const home = rows.find((r) => r.route === "/")!;
  for (const row of rows) {
    for (const role of ROLES) {
      const outcome = resolve(oneOf(expectOf(row, role), device), oneOf(expectOf(home, role), device));
      test(`${role} · ${row.route} ${outcome.title}`, async ({as, app, db, healthy}, testInfo) => {
        // BUG: the line is in the table, next to the outcome
        test.fail(!!outcome.bug, outcome.bug);
        const ids = await idsOf(app, db);
        const path = row.path(ids);
        const own = new RegExp(`^${escape(path)}(\\?.*)?$`);
        const where = outcome.at ? outcome.at(ids, path) : own;

        const page = await as(role);
        const started = Date.now();
        let ready = 0;
        // what a refused role meets: sent elsewhere, one of the app's refusals, or the page itself
        const met = async () => {
          if (!own.test(pathOf(page))) return `sent to ${pathOf(page)}`;
          for (const words of REFUSALS) if (await page.getByText(words).first().isVisible()) return `told "${words}"`;
          return "the page itself";
        };
        const seen = async () => {
          if (outcome.refused) await expect.poll(met, {message: `${role} may not open ${path}`}).not.toBe("the page itself");
          else {
            await expect.poll(() => pathOf(page), {message: `${role} on ${path} should end up here`}).toMatch(where);
            for (const look of [outcome.look!].flat()) await expect(lookFor(page, look, ids)).toBeVisible();
          }
        };
        try {
          const response = await page.goto(path);
          expect(response?.status(), `${path} answers`).toBeLessThan(500);
          await seen();
          ready = Date.now() - started;

          // the page's data has arrived before it is judged: the document's requests are done, and so are the lists
          // and tables a client-side forward (a table to Tko igra, Ekipe to its first team) loads after it
          await page.waitForLoadState("networkidle");
          await expect(page.getByRole("status", {name: "Učitavanje"}), "the page is still loading").toHaveCount(0);
          await seen();
          if (outcome !== notFound) await expect(page.getByRole("heading", {name: "Stranica ne postoji"})).toHaveCount(0);
          await healthy(page);
        } catch (e) {
          // an expected failure takes no screenshot of its own; the bug's report needs one
          if (outcome.bug) await page.screenshot({path: testInfo.outputPath("bug.png")});
          throw e;
        }

        await record(testInfo, {project: testInfo.project.name, test: testInfo.title, path, ready, server: await serverTime(page)});
      });
    }
  }
  test.afterAll(async ({}, testInfo) => {
    const slowest = slowestOf(testInfo);
    if (slowest) console.log(`\n10 slowest pages (${testInfo.project.name}, median of the runs):\n${slowest}`);
  });
}

function resolve(one: One, home: One): Outcome {
  if (one === "login") {
    // Treseta's middleware (loginUrl) brings a guest back with ?next= from Burza's pages only (BELA_SYNC.md · Not
    // copied, Gost i poziv)
    const back = (path: string) => path.startsWith("/burza");
    return {
      title: "→ Prijava",
      at: (_, path) => new RegExp(`^/login${back(path) ? `\\?next=${escape(encodeURIComponent(path))}` : ""}$`),
      look: PRIJAVA,
    };
  }
  if (one === "home") {
    if (typeof home !== "object") throw new Error("Početna's own line must say what it shows");
    return {...home, title: "→ Početna", at: () => /^\/$/};
  }
  return one;
}

const pathOf = (page: Page) => {
  const url = new URL(page.url());
  return url.pathname + url.search;
};

function lookFor(page: Page, look: Look, ids: Ids) {
  const value = (s: Seen) => (typeof s === "function" ? s(ids) : s);
  if ("text" in look) return page.getByText(value(look.text)).first();
  const name = value(look.name);
  return page.getByRole(look.role, {name, exact: typeof name === "string", includeHidden: look.hidden}).first();
}

// how long the server took for the page's document (Navigation Timing), in ms
async function serverTime(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav ? Math.round(nav.responseStart - nav.requestStart) : -1;
  });
}

// ---------- timings (information only) ----------

// Playwright empties the output folder at the start of a run, so the file holds this run's timings only
const timingsFile = (testInfo: TestInfo) => join(testInfo.project.outputDir, "a-timings.jsonl");

async function record(testInfo: TestInfo, t: Timing) {
  testInfo.annotations.push({type: "vrijeme", description: `${t.ready} ms do stranice (poslužitelj ${t.server} ms)`});
  mkdirSync(testInfo.project.outputDir, {recursive: true});
  appendFileSync(timingsFile(testInfo), JSON.stringify(t) + "\n");
}

function slowestOf(testInfo: TestInfo): string | null {
  const file = timingsFile(testInfo);
  if (!existsSync(file)) return null;
  const runs = new Map<string, Timing[]>();
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const t = JSON.parse(line) as Timing;
    if (t.project !== testInfo.project.name) continue;
    runs.set(t.test, [...(runs.get(t.test) ?? []), t]);
  }
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const rows = [...runs.entries()]
    .map(([name, ts]) => ({name, path: ts[0].path, ready: median(ts.map((t) => t.ready)), server: median(ts.map((t) => t.server)), n: ts.length}))
    .sort((a, b) => b.ready - a.ready)
    .slice(0, 10);
  const text = rows.map((r, i) => `${String(i + 1).padStart(2)}. ${String(r.ready).padStart(5)} ms (poslužitelj ${r.server} ms, ${r.n}×)  ${r.name}  ${r.path}`).join("\n");
  writeFileSync(join(testInfo.project.outputDir, `a-slowest-${testInfo.project.name}.txt`), text + "\n");
  return text;
}


// ---------- the table: every page and what each role sees there ----------

// BUG (Bela #88): a signed-in player who doesn't play at a table (the organizer, not at the player's table) gets its
// board and the hand steps, and only Spremi tells them "Ne igraš u ovoj rundi." (403; Tko igra of such a table says it
// at once). Shared code, not fixed in Bela yet.
const NOT_AT_TABLE = bug(
  `Bela #88: a player who doesn't play at the table gets its scorepad and hand steps as if they did; only Spremi answers "${NOT_YOUR_ROUND}"`,
  REFUSED,
);

// a match's board with its saved hands ("Igra 1: …"; the computer's board has the next hand's entry open beside it,
// the phone's Upiši igru)
const BOARD = button(/^Igra 1: /);

const playedNow = (ids: Ids) => `(${ids.playedNow.join("|")})`;
// Novo kolo is a view of Upravljanje ligom of the picked league; nothing is picked in a fresh browser, so it is the
// league being played now
const novoKolo = (ids: Ids) => new RegExp(`^/league/${playedNow(ids)}/manage\\?view=create$`);
const newAd = (vrsta: string, title: string): Row => ({route: `/burza/novi/[vrsta] · ${vrsta}`, path: () => `/burza/novi/${vrsta}`, all: h(title)});
const tournament = (state: keyof Ids["tournaments"], label: string, page = ""): Row => ({
  route: `/turniri/[id]${page}${label ? ` · ${label}` : ""}`,
  path: (ids) => `/turniri/${ids.tournaments[state].id}${page}`,
  public: true,
  all: h(page === "/poredak" ? "Poredak" : page === "/ekipe" ? "Prijavljene ekipe" : (ids: Ids) => ids.tournaments[state].name),
});
// Treseta's hand entry has two steps (BELA_SYNC.md · Game rules), where Bela's has three (the trump caller first):
// Zvanja (3 and 4 for each team) and Igra (the keypad); helpers/scorepad.ts reads them the same way
const handStep = (hand: "[resultId]" | "new", step: "zvanja" | "score"): Row => ({
  route: `/ongoing-match/[matchId]/ongoing-result/${hand}/${step}`,
  path: (ids) => `/ongoing-match/${ids.table.matchId}/ongoing-result/${hand === "new" ? "new" : ids.table.handId}/${step}`,
  all: step === "zvanja" ? shows({role: "radiogroup", name: "Zvanja: upis za ekipu"}) : shows({role: "group", name: "Bodovi igre"}),
  organizer: NOT_AT_TABLE,
});
// a view of Upravljanje ligom (?view=, Treseta's own views: the conferences and Podjela): the admin's on both; anyone
// else's phone says it is edited on the computer, and the computer refuses
const manageView = (view: string, label: string, admin: Expect): Row => ({
  route: `/league/[leagueId]/manage · ${label}`,
  path: (ids) => `/league/${ids.league}/manage?view=${view}`,
  all: per(desktopOnly, says(NO_RIGHT)),
  admin,
});

export const PAGES: Row[] = [
  // Početna (page.tsx): a player's; on the phone an organizer opens on their Turniri and an admin on Večer lige
  // (DECISIONS #59, #86); on the computer everyone logged in is welcomed by name. Treseta has no guest Početna (Gost i
  // poziv isn't copied): a guest is sent to Prijava.
  {
    route: "/",
    path: () => "/",
    player: per(button("Moj profil"), h((ids) => `Dobrodošao, ${ids.firstName.player}`)),
    // the organizer's phone opens on their Turniri (Bela's 52ef6b3, on master since the sync of 17 Nov 2026)
    organizer: per(h("Turniri"), h((ids) => `Dobrodošao, ${ids.firstName.organizer}`)),
    admin: per(h("Večer lige"), h((ids) => `Dobrodošao, ${ids.firstName.admin}`)),
  },
  {route: "/login", path: () => "/login", public: true, all: shows(PRIJAVA)},
  {route: "/signup", path: () => "/signup", public: true, all: h("Registracija")},
  // an address the app doesn't have (not-found.tsx); a guest is sent to Prijava first, as for any page not public
  {route: "(not-found)", path: () => "/ne-postoji", all: notFound},

  // Burza igrača: the list and an ad are public, Moji oglasi and the forms need a login
  {route: "/burza", path: () => "/burza", public: true, all: per(h("Burza"), h("Burza igrača"))},
  {route: "/burza/[id]", path: (ids) => `/burza/${ids.ads.open}`, public: true, all: h("Oglas")},
  {route: "/burza/[id] · zatvoren", path: (ids) => `/burza/${ids.ads.closed}`, public: true, all: h("Oglas")},
  {route: "/burza/moji", path: () => "/burza/moji", all: h("Moji oglasi")},
  newAd("zamjena", "Trebam zamjenu"),
  newAd("partner", "Tražim partnera"),
  newAd("dostupan", "Dostupan sam"),

  // the league's pages need a login, but its season table (publicPaths.ts: Treseta's league stays public, BELA_SYNC.md
  // · Not copied, Gost i poziv)
  {route: "/league/[leagueId]/daily-standings", path: (ids) => `/league/${ids.league}/daily-standings`, all: h((ids) => ids.night)},
  {route: "/league/[leagueId]/standings", path: (ids) => `/league/${ids.league}/standings`, public: true, all: h("Ukupni poredak")},
  // a table (DECISIONS #60): its own player goes into the game, the admin to Tko igra (every time), anyone else gets
  // Pregled stola
  {
    route: "/league/[leagueId]/daily-standings/table/[roundId]",
    path: (ids) => `/league/${ids.league}/daily-standings/table/${ids.table.roundId}`,
    player: at("their game", (ids) => new RegExp(`^/ongoing-match/${ids.table.matchId}$`), BOARD),
    organizer: h((ids) => `Stol ${ids.table.number}`),
    admin: at("Tko igra", (ids) => new RegExp(`^/round/lineup/${ids.table.roundId}\\?league=${ids.league}$`), h("Tko igra ovu rundu?")),
  },
  // /league/current/<page> forwards to that page of the league being played now (_lib/league.ts); its season table is
  // public, so a guest gets there too
  {route: "/league/current/[[...page]]", path: () => "/league/current", all: at("the league played now", (ids) => new RegExp(`^/league/${playedNow(ids)}/standings$`), h("Ukupni poredak"))},
  {
    route: "/league/current/[[...page]] · standings",
    path: () => "/league/current/standings",
    public: true,
    all: at("the league played now", (ids) => new RegExp(`^/league/${playedNow(ids)}/standings$`), h("Ukupni poredak")),
  },
  {
    route: "/league/current/[[...page]] · daily-standings",
    path: () => "/league/current/daily-standings",
    all: at("the league played now", (ids) => new RegExp(`^/league/${playedNow(ids)}/daily-standings$`), h((ids) => ids.night)),
  },
  {route: "/league/current/[[...page]] · nepostojeća", path: () => "/league/current/nepostoji", all: notFound},
  // the league's admin screens: the admin's on both; anyone else's phone says it is edited on the computer, and the
  // computer refuses
  {route: "/league/[leagueId]/manage", path: (ids) => `/league/${ids.league}/manage`, all: per(desktopOnly, says(NO_RIGHT)), admin: h("Upravljanje ligom")},
  // Treseta's own views of it: the teams with their conferences, Podaci with the conferences card, the next night's
  // Podjela between two places, and the Kola merged across places (BELA_SYNC.md · Conferences, Lokacije). The world's
  // leagues have no conferences and no night at two places, so these are their empty states.
  manageView("teams", "Ekipe (konferencije)", h("Upravljanje ligom")),
  // BUG (Bela #87): on the computer a player and an organizer get Podaci in full (the league's form, Okupljanje and the
  // Konferencije card with Dodaj konferencije), since its reads are public and nothing refuses them. Shared code (the
  // manage page lets anyone in on the computer), not fixed in Bela yet.
  {
    ...manageView("details", "Podaci (konferencije)", per(h("Upravljanje ligom"), h("Konferencije"))),
    all: per(desktopOnly, bug("Bela #87: on the computer Upravljanje ligom · Podaci shows the league's form and Konferencije to a player and an organizer instead of refusing them", REFUSED)),
  },
  // Podjela opens on the computer only when the next night has two places (manage/page.tsx), else it is Novo kolo; the
  // phone's Podjela ekipa says the night has one place
  manageView("split", "Podjela", per(h("Podjela ekipa"), h("Upravljanje ligom"))),
  manageView("rounds", "Kola", h("Upravljanje ligom")),
  {
    route: "/createRound",
    path: () => "/createRound",
    all: per(desktopOnly, at("Novo kolo", novoKolo, says(NO_RIGHT))),
    admin: per(at("Novo kolo", novoKolo, h("Novo kolo")), at("Novo kolo", novoKolo, h("Upravljanje ligom"))),
  },
  {
    route: "/league/new",
    path: () => "/league/new",
    // BUG (Bela #87): on the computer a player and an organizer get the admin's Nova liga form (with every team and its
    // players). Shared code, not fixed in Bela yet.
    all: per(
      desktopOnly,
      bug("Bela #87: on the computer /league/new shows the admin's Nova liga form to a player and an organizer instead of refusing them", REFUSED),
    ),
    admin: h("Nova liga"),
  },
  // Lokacije (Treseta's own, lokacije/page.tsx): the admin's, who alone may change places (location.manage); anyone
  // else is sent to Početna, the organizer too, who may only add a place from the tournament form (location.create)
  {route: "/lokacije", path: () => "/lokacije", all: "home", admin: h("Lokacije")},

  // the scorepad of the player's table tonight and its hand steps: its players', and the admin's, who may play any
  // table (requireUser.ts canPlayRound); anyone else may not enter or change its hands
  {route: "/ongoing-match/[matchId]", path: (ids) => `/ongoing-match/${ids.table.matchId}`, all: BOARD, organizer: NOT_AT_TABLE},
  handStep("[resultId]", "zvanja"),
  handStep("[resultId]", "score"),
  handStep("new", "zvanja"),
  handStep("new", "score"),
  // Kraj kola of a finished table; Tko igra of a table none of them plays at, which only the admin may start
  {route: "/round/[roundId]/result", path: (ids) => `/round/${ids.finishedTable}/result`, all: h("Kraj kola")},
  {route: "/round/lineup/[roundId]", path: (ids) => `/round/lineup/${ids.otherTable}`, all: says(NOT_YOUR_ROUND), admin: h("Tko igra ovu rundu?")},

  // players and teams: a player's own pages for everyone logged in; the directories (Igrači, Ekipe) for whoever may
  // see them (an organizer too, DECISIONS #86), on the computer opened on the first in the list; players to Početna (#46)
  {route: "/players", path: () => "/players", player: "home", all: per(h("Igrači"), at("the first player", () => /^\/players\/\d+$/, h("Igrači")))},
  {route: "/players/[playerId]", path: (ids) => `/players/${ids.player.id}`, all: h((ids) => ids.player.name)},
  {route: "/teams", path: () => "/teams", player: "home", all: per(h("Ekipe"), at("the first team", () => /^\/teams\/\d+$/, h("Ekipe")))},
  {route: "/teams/[teamId]", path: (ids) => `/teams/${ids.team.id}`, all: h((ids) => ids.team.name)},
  {route: "/profile", path: () => "/profile", player: h("player"), organizer: h("organizer"), admin: h("admin")},
  {route: "/raspored", path: () => "/raspored", all: h("Raspored")},
  {route: "/ratings", path: () => "/ratings", all: per(h("Rejting"), h("Rejting igrača"))},
  {route: "/ratings/[playerId]", path: (ids) => `/ratings/${ids.player.id}`, all: h((ids) => ids.player.name)},
  // Sponzori: the admin's; anyone else is sent to Početna (sponzori/page.tsx)
  {route: "/sponzori", path: () => "/sponzori", all: "home", admin: h("Sponzori")},

  // tournaments: the lists, a tournament's page, its teams and standings are public
  {route: "/turniri", path: () => "/turniri", public: true, all: h("Turniri")},
  {route: "/turniri/uzivo", path: () => "/turniri/uzivo", public: true, all: h("Uživo")},
  {route: "/turniri/nadolazeci", path: () => "/turniri/nadolazeci", public: true, all: h("Nadolazeći turniri")},
  {route: "/turniri/zavrseni", path: () => "/turniri/zavrseni", public: true, all: h("Završeni turniri")},
  tournament("live", "uživo"),
  tournament("finished", "završen"),
  tournament("open", "prijave otvorene"),
  tournament("naProlaz", "na prolaz"),
  tournament("cancelled", "otkazan"),
  tournament("live", "", "/ekipe"),
  tournament("naProlaz", "na prolaz", "/ekipe"),
  tournament("live", "", "/poredak"),
  tournament("finished", "završen", "/poredak"),
  // a table of the live tournament: Pregled stola for a player, Tko igra for the admin; the organizer runs only their
  // own tournaments, so the server answers "Ovo nije tvoj turnir." (DECISIONS #86)
  {
    route: "/turniri/[id]/stol/[roundId]",
    path: (ids) => `/turniri/${ids.tournaments.live.id}/stol/${ids.tournamentTable.roundId}`,
    player: h((ids) => `Stol ${ids.tournamentTable.number}`),
    // BUG (Bela #86): the organizer's phone hides the server's answer behind "Stol se nije učitao. Provjeri vezu …".
    // Shared code, not fixed in Bela yet.
    organizer: per(
      bug(`Bela #86: on the phone an organizer on another's tournament table reads "Stol se nije učitao. Provjeri vezu i pokušaj ponovno." instead of "${NOT_YOURS}"`, says(NOT_YOURS)),
      says(NOT_YOURS),
    ),
    admin: at("Tko igra", (ids) => new RegExp(`^/round/lineup/${ids.tournamentTable.roundId}\\?turnir=${ids.tournaments.live.id}$`), h("Tko igra ovu rundu?")),
  },
  // running a tournament: the admin any, an organizer their own (DECISIONS #86); a player's phone says it is done on
  // the computer, and the computer refuses
  {
    route: "/turniri/[id]/upravljanje",
    path: (ids) => `/turniri/${ids.tournaments.live.id}/upravljanje`,
    player: per(desktopOnly, says(NO_RIGHT)),
    organizer: says(NOT_YOURS),
    admin: h((ids) => ids.tournaments.live.name),
  },
  // the live tournament's Kolo being played, with Treseta's own tools (BELA_SYNC.md · Turniri): Vrijeme kola (the Kolo's
  // timer) and, on its no-show tables, Uredi ishod and Vrati stol
  {
    route: "/turniri/[id]/upravljanje · Kolo (Vrijeme kola, Uredi ishod, Vrati stol)",
    path: (ids) => `/turniri/${ids.tournaments.live.id}/upravljanje?view=kola&kolo=${ids.liveKolo}`,
    player: per(desktopOnly, says(NO_RIGHT)),
    organizer: says(NOT_YOURS),
    admin: shows([
      {role: "timer", name: /^Kolo traje /},
      {role: "button", name: /^Uredi ishod Stola \d+$/},
      {role: "button", name: /^Vrati Stol \d+ u igru$/},
    ]),
  },
  {
    route: "/turniri/[id]/upravljanje · organizatorov",
    path: (ids) => `/turniri/${ids.tournaments.organizer.id}/upravljanje`,
    player: per(desktopOnly, says(NO_RIGHT)),
    all: h((ids) => ids.tournaments.organizer.name),
  },
  {route: "/turniri/upravljanje", path: () => "/turniri/upravljanje", player: per(desktopOnly, says(NO_RIGHT)), all: h("Turniri")},
  {
    route: "/turniri/novi",
    path: () => "/turniri/novi",
    // BUG (Bela #87): on the computer a player gets the Novi turnir form. Shared code, not fixed in Bela yet.
    player: per(desktopOnly, bug("Bela #87: on the computer /turniri/novi shows the Novi turnir form to a player instead of refusing them", REFUSED)),
    all: h("Novi turnir"),
  },
];
