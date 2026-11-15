// The suite's fixtures: import {test, expect} from here, not from @playwright/test.
//   world   the generated world's catalog (ids of accounts, leagues, tables, tournaments, ads …)
//   app     this section's server and database (e2e/local/app.sh)
//   db      a Prisma client on this section's database
//   as(who) a page in its own context, logged in through the API: a role ("admin", "player" …), a username, or "guest"
//   healthy(page) asserts the page is healthy (helpers/health.ts); pages from as() are watched from the start
import {test as base, expect, type BrowserContext, type Page} from "@playwright/test";
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
  healthy: (page: Page) => Promise<void>;
};

const watches = new WeakMap<Page, Watch>();

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
      const context = await browser.newContext({...screen, baseURL: app.baseURL});
      contexts.push(context);
      // Treseta's install sheet slides over Početna on every phone visit in the browser (src/app/_ui/install/
      // InstallSheet.tsx): the tests are the app opened from the home screen, as most players use it
      await context.addInitScript(() => Object.defineProperty(navigator, "standalone", {get: () => true}));
      if (who !== "guest") {
        const username = world.accounts[who]?.username ?? who;
        const res = await context.request.post("/api/login", {data: {username, password: PASSWORD}});
        expect(res.ok(), `login as ${username}: ${res.status()} ${await res.text()}`).toBeTruthy();
      }
      const page = await context.newPage();
      watches.set(page, watch(page));
      return page;
    });
    for (const context of contexts) await context.close();
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
