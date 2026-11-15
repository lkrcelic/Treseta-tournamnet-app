// K · Novo kolo on the admin's phone with "Samo unutar konferencija" (docs/arhiva/CONFERENCES_PLAN.md, D1): the switch
// is there only in a league with conferences and is off at first. On, every conference is paired on its own, so every
// table has two teams of one conference, and a conference with too few teams for the Kola is refused with its name.
// Off, the pairing ignores conferences. Skica kola shows each team's dot. The test's own league (helpers/k.ts): Sjever
// has ranks 1, 4, 5, 8 of the table and Jug 2, 3, 6, 7.
import type {Page} from "@playwright/test";
import {BYE_TEAM_ID} from "@/app/_lib/bye";
import {addConferences, escape, expect, test, tonightTables, type Conferences, type KTeam, type Liga} from "../../helpers/k";

// Novo kolo for tonight, one Kolo; `out`: the teams switched off in Tko igra večeras
async function openNovoKolo(page: Page, liga: Liga, out: KTeam[] = []) {
  await page.goto(`/league/${liga.id}/manage?view=create`);
  await expect(page.getByRole("heading", {name: "Novo kolo"})).toBeVisible();
  const rounds = page.getByRole("radiogroup", {name: "Broj kola večeras"});
  await rounds.getByRole("radio", {name: "1", exact: true}).click();
  await expect(rounds.getByRole("radio", {name: "1", exact: true})).toBeChecked();
  const who = page.getByRole("region", {name: "Tko igra večeras"});
  await expect(who.getByRole("status")).toHaveText(/^8 \/ 8\s*ekipa igra večeras$/);
  if (out.length) {
    await who.getByRole("button", {name: "Promijeni"}).click();
    const sheet = page.getByRole("dialog", {name: "Tko igra večeras?"});
    for (const t of out) {
      const team = sheet.getByRole("switch", {name: t.name, exact: true});
      await team.click();
      await expect(team).not.toBeChecked();
    }
    await sheet.getByRole("button", {name: "Gotovo"}).click();
    await expect(sheet).toBeHidden();
    await expect(who.getByRole("status")).toHaveText(new RegExp(`^${8 - out.length} / 8\\s*ekipa igra večeras$`));
  }
}

const withinSwitch = (page: Page) => page.getByRole("switch", {name: /^Samo unutar konferencija/});

// Kreiraj, then Skica kola's Odobri sva and Objavi; resolves once the Kolo is published
async function createAndPublish(page: Page, tables: number) {
  await page.getByRole("button", {name: `Kreiraj 1 kolo · ${tables} stola`}).click();
  await expect(page.getByRole("heading", {name: "Skica kola"})).toBeVisible();
  await page.getByRole("button", {name: "Odobri sva"}).click();
  await page.getByRole("button", {name: "Objavi odobrena kola · 1/1"}).click();
  await expect(page.getByText("Sva kola su objavljena")).toBeVisible();
}

const teamById = (liga: Liga, id: number) => liga.teams.find((t) => t.id === id);
const confOf = (liga: Liga, conf: Conferences, id: number) => {
  const team = teamById(liga, id);
  return team ? conf.of(team).name : "bye";
};

test("with Samo unutar konferencija on, every table of the new Kolo pairs two teams of one conference", async ({as, db, liga, healthy}) => {
  const conf = await addConferences(liga);
  const page = await as("admin");
  await openNovoKolo(page, liga);
  await expect(withinSwitch(page)).not.toBeChecked();
  await withinSwitch(page).click();
  await expect(withinSwitch(page)).toBeChecked();
  await page.getByRole("button", {name: "Kreiraj 1 kolo · 4 stola"}).click();

  // Skica kola: four tables, each with two dots of one conference
  await expect(page.getByRole("heading", {name: "Skica kola"})).toBeVisible();
  const draft = await tonightTables(db, liga);
  expect(draft.map((t) => t.status)).toEqual(["DRAFT", "DRAFT", "DRAFT", "DRAFT"]);
  const rows = page.getByRole("list", {name: "Skica A, stolovi"}).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  for (const t of draft) {
    const [a, b] = [teamById(liga, t.team1)!, teamById(liga, t.team2)!];
    const row = rows.filter({hasText: new RegExp(`^${t.tableNumber}\\s*${escape(a.name)}\\s*vs\\s*${escape(b.name)}$`)});
    await expect(row.getByRole("img")).toHaveCount(2);
    await expect(row.getByRole("img").nth(0)).toHaveAccessibleName(conf.of(a).name);
    await expect(row.getByRole("img").nth(1)).toHaveAccessibleName(conf.of(b).name);
  }
  await page.getByRole("button", {name: "Odobri sva"}).click();
  await page.getByRole("button", {name: "Objavi odobrena kola · 1/1"}).click();
  await expect(page.getByText("Sva kola su objavljena")).toBeVisible();

  // published: every team once, every table within a conference, two tables each
  const published = await tonightTables(db, liga);
  expect(published.map((t) => [t.status, t.team1, t.team2])).toEqual(draft.map((t) => ["PUBLISHED", t.team1, t.team2]));
  expect(published.flatMap((t) => [t.team1, t.team2]).sort()).toEqual(liga.teams.map((t) => t.id).sort());
  const pairs = published.map((t) => [confOf(liga, conf, t.team1), confOf(liga, conf, t.team2)]);
  expect(pairs.filter(([a, b]) => a === b).map(([a]) => a).sort()).toEqual(["Jug", "Jug", "Sjever", "Sjever"]);
  await healthy(page);
});

test("with Samo unutar konferencija off, the pairing ignores conferences", async ({as, db, liga, healthy}) => {
  const conf = await addConferences(liga);
  // one team of each sits out: three of Sjever and three of Jug play, so three tables of two teams of one conference
  // can't be made, and the pairing that ignores conferences must put one Sjever team against a Jug team
  const out = [liga.teams[7], liga.teams[6]];
  expect(out.map((t) => conf.of(t).name)).toEqual(["Sjever", "Jug"]);
  const page = await as("admin");
  await openNovoKolo(page, liga, out);
  await expect(withinSwitch(page)).not.toBeChecked();
  await createAndPublish(page, 3);

  const published = await tonightTables(db, liga);
  expect(published).toHaveLength(3);
  expect(published.flatMap((t) => [t.team1, t.team2]).sort()).toEqual(
    liga.teams
      .filter((t) => !out.includes(t))
      .map((t) => t.id)
      .sort(),
  );
  const pairs = published.map((t) => [confOf(liga, conf, t.team1), confOf(liga, conf, t.team2)]);
  expect(pairs.filter(([a, b]) => a !== b).length).toBeGreaterThan(0);
  expect(pairs.flat().sort()).toEqual(["Jug", "Jug", "Jug", "Sjever", "Sjever", "Sjever"]);
  await healthy(page);
});

test("with Samo unutar konferencija on, a conference with too few teams tonight is refused with its name", async ({as, db, liga, healthy}) => {
  const conf = await addConferences(liga);
  // three of Jug's four sit out: Jug has one team, too few for one Kolo within the conference
  const jugOut = liga.teams.filter((t) => [3, 6, 7].includes(t.rank));
  expect(jugOut.map((t) => conf.of(t).name)).toEqual(["Jug", "Jug", "Jug"]);
  const page = await as("admin");
  await openNovoKolo(page, liga, jugOut);
  await withinSwitch(page).click();
  await expect(withinSwitch(page)).toBeChecked();
  await page.getByRole("button", {name: "Kreiraj 1 kolo · 2 stola"}).click();
  // (the page's other alert is Next's empty route announcer)
  await expect(page.getByRole("alert").filter({hasText: /\S/})).toHaveText("Jug večeras ima 1 ekipu, premalo za 1 kolo unutar konferencije.");
  await expect(page.getByRole("heading", {name: "Novo kolo"})).toBeVisible();
  expect(await tonightTables(db, liga)).toEqual([]);

  // switched off, the same five teams make a Kolo: two tables and a bye
  await withinSwitch(page).click();
  await expect(withinSwitch(page)).not.toBeChecked();
  await createAndPublish(page, 2);
  const published = await tonightTables(db, liga);
  expect(published.map((t) => t.status)).toEqual(["PUBLISHED", "PUBLISHED", "PUBLISHED"]);
  const playing = liga.teams.filter((t) => !jugOut.includes(t)).map((t) => t.id);
  expect(published.flatMap((t) => [t.team1, t.team2]).sort((a, b) => a - b)).toEqual([BYE_TEAM_ID, ...playing].sort((a, b) => a - b));
  await healthy(page);
});
