// Is a page healthy? Watches a page from the start (console errors, page errors, 5xx answers) and checks what a
// person would see as broken: horizontal scroll on the phone, undefined / NaN / Invalid Date in the text (also in
// the tab's title and in what a screen reader reads: aria-label, title, alt, placeholder), the app's error screen
// ("Nešto je pošlo po zlu", or Next's own "Application error") and a part of the page that didn't load (ErrorState:
// "… se nije učitao", "Provjeri vezu i pokušaj ponovno.").
// Section A owns this file after the base; everyone may call it.
import {expect, type Page} from "@playwright/test";

const BROKEN_TEXT = /\bundefined\b|\bNaN\b|Invalid Date/;
// src/app/_ui/sp/PageMessage.tsx PAGE_ERROR (app/error, app/global-error) and Next's own screen without them
const ERROR_SCREEN = ["Nešto je pošlo po zlu", "Application error: a"];
// src/app/_ui/sp/States.tsx ErrorState: every page or list that didn't load says this under its title
const LOAD_ERROR = "Provjeri vezu i pokušaj ponovno.";

export type Watch = {problems: string[]};

export function watch(page: Page): Watch {
  const w: Watch = {problems: []};
  page.on("console", (m) => {
    // the browser logs every 4xx/5xx answer as "Failed to load resource"; answers are judged below, by status,
    // because a 401 from /api/auth/me before login or a 404 for "no open table" is expected
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) w.problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => w.problems.push(`page error: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) w.problems.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return w;
}

// What a page shows that a health check reads: its scroll, its visible text and its screen-reader words
async function readPage(page: Page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
    text: document.body.innerText,
    title: document.title,
    labels: [...document.querySelectorAll("[aria-label], [title], [alt], [placeholder]")].flatMap((el) =>
      ["aria-label", "title", "alt", "placeholder"].map((a) => el.getAttribute(a)).filter((v): v is string => !!v),
    ),
  }));
}

// Everything wrong with the page as it is now, in words; [] when it is healthy
export async function problemsOf(page: Page, w: Watch): Promise<string[]> {
  const {scroll, width, text, title, labels} = await readPage(page);
  const problems = [...w.problems];
  if (scroll > width) problems.push(`horizontal scroll: ${scroll} > ${width}`);
  const broken = text.match(BROKEN_TEXT);
  if (broken) problems.push(`page text shows "${broken[0]}"`);
  if (BROKEN_TEXT.test(title)) problems.push(`tab title "${title}"`);
  const label = labels.find((l) => BROKEN_TEXT.test(l));
  if (label) problems.push(`screen-reader text "${label}"`);
  const screen = ERROR_SCREEN.find((s) => text.includes(s));
  if (screen) problems.push(`error screen "${screen}…"`);
  if (text.includes(LOAD_ERROR)) problems.push(`part of the page didn't load ("${LOAD_ERROR}")`);
  return problems;
}

export async function expectHealthy(page: Page, w: Watch) {
  expect(await problemsOf(page, w), `${page.url()} is not healthy`).toEqual([]);
}
