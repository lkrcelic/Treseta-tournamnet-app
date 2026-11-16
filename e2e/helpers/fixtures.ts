// The suite's fixtures: import {test, expect} from here, not from @playwright/test.
//   world   the generated world's catalog (ids of accounts, leagues, tables, tournaments, ads …)
//   app     this section's server and database (e2e/local/app.sh)
//   db      a Prisma client on this section's database
//   as(who) a page in its own context, logged in through the API: a role ("admin", "player" …), a username, or "guest"
//   api(who) a request context logged in the same way, for setup through the app's own routes (no page, no browser)
//   healthy(page) asserts the page is healthy (helpers/health.ts); pages from as() are watched from the start
import {test as base, expect, type APIRequestContext, type BrowserContext, type Page} from "@playwright/test";
import {openDb, type Db} from "./db";
import {DESKTOP, PHONE} from "./devices";
import {expectHealthy, watch, type Watch} from "./health";
import {appInfo, loadWorld, type App, type World} from "./world";

// every generated account shares the password of prisma/seed.ts
export const PASSWORD = process.env.E2E_PASSWORD ?? "sifra";

type Fixtures = {
  app: App;
  world: World["catalog"];
  db: Db;
  as: (who: string) => Promise<Page>;
  api: (who: string) => Promise<APIRequestContext>;
  healthy: (page: Page) => Promise<void>;
};

const watches = new WeakMap<Page, Watch>();

// Every context is a phone (or computer) of its own, with its own address. The app limits API requests per address
// (src/app/_lib/rateLimiting/requestLimiting.ts: 1000, and the count only starts again after a minute without any
// request), and under `next start` the address is the X-Forwarded-For header, so without one the whole suite would
// share a single count and get 429 after ~1000 calls. The login limits are per address and account as well.
// Only the app's /api requests carry it (the limit counts nothing else): on a request to Google Fonts the header
// would fail the CORS preflight and the page would log the blocked fonts. Routing turns the browser's HTTP cache off
// for the context, so page timings measured through as() are those of a first visit.
let lastAddress = Math.floor(Math.random() * 0xfffff0);
function ownAddress(): Record<string, string> {
  lastAddress = (lastAddress + 1) % 0xffffff;
  return {"X-Forwarded-For": `10.${(lastAddress >> 16) & 255}.${(lastAddress >> 8) & 255}.${lastAddress & 255}`};
}

// logs a request context in as a role from the catalog or a username, through the app's own /api/login
async function login(request: APIRequestContext, world: World["catalog"], who: string, headers: Record<string, string>) {
  const username = world.accounts[who]?.username ?? who;
  const res = await request.post("/api/login", {data: {username, password: PASSWORD}, headers});
  expect(res.ok(), `login as ${username}: ${res.status()} ${await res.text()}`).toBeTruthy();
}

// Prijava stores the logged-in user (src/app/_store/authStore.ts, persisted as "auth-store") before any page opens.
// A context logged in through the API has the cookie only, so on its first load refreshUser finds no stored user and
// drops the stored match and round: when /api/auth/me answers after the scorepad fetched its match, the board shows no
// hands until its next refresh (C2, once in 20 runs). So the context stores the user as Prijava would, on a load that
// finds no store yet; after Odjava the store is there with no user, and stays so.
async function storeUser(context: BrowserContext, headers: Record<string, string>) {
  const res = await context.request.get("/api/auth/me", {headers});
  expect(res.ok(), `/api/auth/me after login: ${res.status()}`).toBeTruthy();
  const {user} = (await res.json()) as {user: unknown};
  // every document of the context runs it, also ones without storage (an opaque origin), where localStorage throws
  await context.addInitScript((u) => {
    try {
      if (localStorage.getItem("auth-store") == null) localStorage.setItem("auth-store", JSON.stringify({state: {user: u}, version: 0}));
    } catch {
      // no storage in this document: nothing to store
    }
  }, user);
}

export const test = base.extend<Fixtures>({
  app: async ({}, use) => {
    await use(appInfo());
  },
  world: async ({app}, use) => {
    await use(loadWorld(app).catalog);
  },
  db: async ({app}, use) => {
    const db = openDb(app.databaseUrl);
    await use(db);
    await db.$disconnect();
  },
  as: async ({browser, app, world}, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    const screen = testInfo.project.name === "racunalo" ? DESKTOP : PHONE;
    await use(async (who: string) => {
      const address = ownAddress();
      const context = await browser.newContext({...screen, baseURL: app.baseURL});
      contexts.push(context);
      await context.route(`${app.baseURL}/api/**`, (route) => route.continue({headers: {...route.request().headers(), ...address}}));
      // Treseta's install sheet slides over Početna on every phone visit in the browser (src/app/_ui/install/
      // InstallSheet.tsx): the tests are the app opened from the home screen, as most players use it
      await context.addInitScript(() => Object.defineProperty(navigator, "standalone", {get: () => true}));
      if (who !== "guest") {
        await login(context.request, world, who, address);
        await storeUser(context, address);
      }
      const page = await context.newPage();
      watches.set(page, watch(page));
      return page;
    });
    for (const context of contexts) await context.close();
  },
  api: async ({playwright, app, world}, use) => {
    const requests: APIRequestContext[] = [];
    await use(async (who: string) => {
      const address = ownAddress();
      const request = await playwright.request.newContext({baseURL: app.baseURL, extraHTTPHeaders: address});
      requests.push(request);
      if (who !== "guest") await login(request, world, who, address);
      return request;
    });
    for (const request of requests) await request.dispose();
  },
  healthy: async ({}, use) => {
    await use(async (page: Page) => {
      let w = watches.get(page);
      if (!w) {
        w = watch(page);
        watches.set(page, w);
      }
      await expectHealthy(page, w);
    });
  },
});

export {expect};
