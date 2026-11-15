// The Treseta suite (E2E_SUITE_PLAN.md). Locally each section runs against its own server and database:
//   e2e/local/app.sh start <id>, then E2E_ID=<id> npx playwright test -c e2e [files]
import {defineConfig} from "@playwright/test";
import {DESKTOP, PHONE} from "./helpers/devices";
import {appInfoOrNull, sectionId} from "./helpers/world";

const id = sectionId();
const app = appInfoOrNull();

export default defineConfig({
  testDir: "./tests",
  outputDir: `./local/run/${id}/results`,
  // a section's tests share one world, so they run one after another
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: Number(process.env.E2E_RETRIES ?? 0),
  timeout: 60_000,
  expect: {timeout: 10_000},
  reporter: [["list"], ["html", {outputFolder: `./local/run/${id}/report`, open: "never"}]],
  use: {
    baseURL: app?.baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {name: "mobitel", testIgnore: /\.racunalo\.spec\.ts$/, use: {browserName: "chromium", ...PHONE}},
    {name: "racunalo", testMatch: /\.racunalo\.spec\.ts$/, use: {browserName: "chromium", ...DESKTOP}},
  ],
});
