// K · standings per conference (docs/arhiva/CONFERENCES_PLAN.md, D2 and "Per-conference views"): Ukupni poredak and
// Dnevni poredak's Tablica okupljanja get a filter, Sve · ● Sjever · ● Jug; a conference's view is the same table with
// only its teams, ranked from 1. The pick is kept per league for the browser tab, so it survives a reload and both
// pages show the same conference. The test's own league (helpers/k.ts): Sjever has ranks 1, 4, 5, 8 of the table and
// Jug 2, 3, 6, 7; tonight's Kolo is published, so all eight are in tonight's Tablica okupljanja.
import type {Locator, Page} from "@playwright/test";
import {LEAGUE_NAME, SNAKE, addConferences, expect, publishKolo, test} from "../../helpers/k";

// The list's rows are these teams in this order, ranked 1, 2, 3 …
async function expectRanking(list: Locator, names: string[]) {
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(names.length);
  for (const [i, name] of names.entries()) {
    await expect(rows.nth(i).getByRole("link")).toHaveAccessibleName(name);
    await expect(rows.nth(i).getByLabel(`${i + 1}. mjesto`, {exact: true})).toBeVisible();
  }
}

// The list's teams in any order (tonight nobody has played yet, so the order says nothing)
async function expectTeams(list: Locator, page: Page, names: string[]) {
  await expect(list.getByRole("listitem")).toHaveCount(names.length);
  for (const name of names) await expect(list.getByRole("listitem").filter({has: page.getByRole("link", {name, exact: true})})).toHaveCount(1);
}

test("Ukupni poredak and Dnevni poredak with a conference picked show only its teams, ranked from 1, and the pick stays after a reload", async ({as, db, liga, healthy}) => {
  await addConferences(liga);
  await publishKolo(liga, db);
  const all = liga.teams.map((t) => t.name);
  const sjever = liga.teams.filter((t) => (SNAKE.first as readonly number[]).includes(t.rank)).map((t) => t.name);
  const jug = liga.teams.filter((t) => (SNAKE.second as readonly number[]).includes(t.rank)).map((t) => t.name);
  const page = await as(liga.phone);

  // Ukupni poredak: Sve, the whole table
  await page.goto(`/league/${liga.id}/standings`);
  const filter = page.getByRole("radiogroup", {name: "Konferencija"});
  await expect(filter.getByRole("radio")).toHaveText(["Sve", "Sjever", "Jug"]);
  await expect(filter.getByRole("radio", {name: "Sve", exact: true})).toBeChecked();
  await expectRanking(page.getByLabel(`Ukupni poredak: ${LEAGUE_NAME}`, {exact: true}), all);

  // Jug: its four, ranked 1–4 in the table's order (2nd, 3rd, 6th, 7th of the league)
  await filter.getByRole("radio", {name: "Jug", exact: true}).click();
  await expect(filter.getByRole("radio", {name: "Jug", exact: true})).toBeChecked();
  const seasonJug = page.getByLabel(`Ukupni poredak: ${LEAGUE_NAME} · Jug`, {exact: true});
  await expectRanking(seasonJug, jug);
  await page.reload();
  await expect(filter.getByRole("radio", {name: "Jug", exact: true})).toBeChecked();
  await expectRanking(seasonJug, jug);
  await healthy(page);

  // Dnevni poredak in the same tab: Jug is picked there too, and tonight's table has only Jug's teams
  await page.goto(`/league/${liga.id}/daily-standings?date=${liga.night}`);
  await expect(filter.getByRole("radio", {name: "Jug", exact: true})).toBeChecked();
  await expectTeams(page.getByLabel(/^Poredak okupljanja .+ · Jug$/), page, jug);

  // Sjever, kept through a reload
  await filter.getByRole("radio", {name: "Sjever", exact: true}).click();
  const tonightSjever = page.getByLabel(/^Poredak okupljanja .+ · Sjever$/);
  await expectTeams(tonightSjever, page, sjever);
  await page.reload();
  await expect(filter.getByRole("radio", {name: "Sjever", exact: true})).toBeChecked();
  await expectTeams(tonightSjever, page, sjever);
  await healthy(page);

  // back on Ukupni poredak it is Sjever's table: 1st, 4th, 5th and 8th of the league, ranked 1–4
  await page.goto(`/league/${liga.id}/standings`);
  await expect(filter.getByRole("radio", {name: "Sjever", exact: true})).toBeChecked();
  await expectRanking(page.getByLabel(`Ukupni poredak: ${LEAGUE_NAME} · Sjever`, {exact: true}), sjever);

  // Sve: every team again, on both pages
  await filter.getByRole("radio", {name: "Sve", exact: true}).click();
  await expectRanking(page.getByLabel(`Ukupni poredak: ${LEAGUE_NAME}`, {exact: true}), all);
  await page.goto(`/league/${liga.id}/daily-standings?date=${liga.night}`);
  await expect(filter.getByRole("radio", {name: "Sve", exact: true})).toBeChecked();
  await expectTeams(page.getByRole("tabpanel", {name: "Tablica okupljanja"}), page, all);
});
