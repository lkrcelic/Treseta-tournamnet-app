// Is a page healthy? Watches a page from the start (console errors, page errors, 5xx answers) and checks what a
// person would see as broken (horizontal scroll on the phone, undefined / NaN / Invalid Date in the text).
// Section A owns this file after the base; everyone may call it.
import {expect, type Page} from "@playwright/test";

const BROKEN_TEXT = /\bundefined\b|\bNaN\b|Invalid Date/;

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

export async function expectHealthy(page: Page, w: Watch) {
  const {scroll, width, text} = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
    text: document.body.innerText,
  }));
  const problems = [...w.problems];
  if (scroll > width) problems.push(`horizontal scroll: ${scroll} > ${width}`);
  const broken = text.match(BROKEN_TEXT);
  if (broken) problems.push(`page text shows "${broken[0]}"`);
  expect(problems, `${page.url()} is not healthy`).toEqual([]);
}
