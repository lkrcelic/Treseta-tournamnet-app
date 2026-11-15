// K · a league without conferences looks as it did before them (docs/arhiva/CONFERENCES_PLAN.md, D3 and "What it
// does"): no dot before a team's name, no Sve · Sjever · Jug filter on Ukupni poredak and Dnevni poredak, and no
// "Samo unutar konferencija" in Novo kolo. The test's own league (helpers/k.ts), the same as the conference tests'
// but without conferences, with tonight's Kolo published.
import {LEAGUE_NAME, expect, publishKolo, standingsRow, test} from "../../helpers/k";

test("a league without conferences shows no dots and no conference filter, and Novo kolo has no Samo unutar konferencija", async ({as, db, liga, healthy}) => {
  // the admin's Novo kolo, before tonight's Kolo
  const admin = await as("admin");
  // the switch depends on the league's conferences: judged once they have come
  const conferences = admin.waitForResponse((r) => r.url().endsWith(`/api/leagues/${liga.id}/conferences`) && r.ok());
  await admin.goto(`/league/${liga.id}/manage?view=create`);
  await expect(admin.getByRole("heading", {name: "Novo kolo"})).toBeVisible();
  expect(((await (await conferences).json()) as {conferences: unknown[]}).conferences).toEqual([]);
  await expect(admin.getByRole("region", {name: "Tko igra večeras"}).getByRole("status")).toHaveText(/^8 \/ 8\s*ekipa igra večeras$/);
  await expect(admin.getByRole("region", {name: "Kola i prozor"})).toContainText("Ekipa se sparuje s ekipama do 8 mjesta");
  await expect(admin.getByRole("switch", {name: /Samo unutar konferencija/})).toHaveCount(0);
  await healthy(admin);

  const tables = await publishKolo(liga, db);
  const page = await as(liga.phone);

  // Ukupni poredak: all eight, no filter, no dot
  await page.goto(`/league/${liga.id}/standings`);
  const season = page.getByLabel(`Ukupni poredak: ${LEAGUE_NAME}`, {exact: true});
  await expect(season.getByRole("listitem")).toHaveCount(8);
  for (const team of liga.teams) await expect(standingsRow(season, page, team.name).getByRole("img")).toHaveCount(0);
  await expect(page.getByRole("radiogroup", {name: "Konferencija"})).toHaveCount(0);

  // Dnevni poredak: Tablica okupljanja and the Kolo's tables the same
  await page.goto(`/league/${liga.id}/daily-standings?date=${liga.night}`);
  const gathering = page.getByRole("tabpanel", {name: "Tablica okupljanja"});
  await expect(gathering.getByRole("listitem")).toHaveCount(8);
  for (const team of liga.teams) await expect(standingsRow(gathering, page, team.name).getByRole("img")).toHaveCount(0);
  await expect(page.getByRole("radiogroup", {name: "Konferencija"})).toHaveCount(0);
  const kolo = `Kolo ${tables[0].roundNumber}`;
  await page.getByRole("tab", {name: kolo}).click();
  const panel = page.getByRole("tabpanel", {name: kolo});
  // every table opens its scorepad; the player's own one is Započni igru
  await expect(panel.getByRole("link", {name: /^Stol \d+: /}).or(panel.getByRole("button", {name: /^Stol \d+: /}))).toHaveCount(4);
  for (const team of liga.teams) {
    const name = panel.getByRole("link", {name: `Ekipa ${team.name}`, exact: true});
    await expect(name).toBeVisible();
    await expect(name.getByRole("img")).toHaveCount(0);
  }
  await healthy(page);
});
