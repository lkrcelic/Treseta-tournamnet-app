// K · the dot: once a league has conferences, every team's name has a dot in its conference's color before it wherever
// the league's teams are listed (docs/arhiva/CONFERENCES_PLAN.md, "Dots"; BELA_SYNC.md · Conferences): Ukupni poredak,
// Dnevni poredak's Tablica okupljanja and its Kolo's tables, and Početna's Započni igru card, which shows the two
// teams' conference colors instead of green and red. The dot is named after its conference for screen readers.
// Each test has its own league (helpers/k.ts) with Sjever (plava) and Jug (tirkizna) and tonight's Kolo published.
import {LEAGUE_NAME, addConferences, escape, expect, expectDot, publishKolo, rgb, standingsRow, test} from "../../helpers/k";

test("each team's dot in its conference color shows on Ukupni poredak, Dnevni poredak and the Kolo's tables", async ({as, db, liga, healthy}) => {
  const conf = await addConferences(liga);
  const tables = await publishKolo(liga, db);
  const page = await as(liga.phone);

  // Ukupni poredak: every row
  await page.goto(`/league/${liga.id}/standings`);
  const season = page.getByLabel(`Ukupni poredak: ${LEAGUE_NAME}`, {exact: true});
  await expect(season.getByRole("listitem")).toHaveCount(8);
  for (const team of liga.teams) await expectDot(standingsRow(season, page, team.name), conf.of(team));
  await healthy(page);

  // Dnevni poredak tonight: Tablica okupljanja's rows
  await page.goto(`/league/${liga.id}/daily-standings?date=${liga.night}`);
  const gathering = page.getByRole("tabpanel", {name: "Tablica okupljanja"});
  await expect(gathering.getByRole("listitem")).toHaveCount(8);
  for (const team of liga.teams) await expectDot(standingsRow(gathering, page, team.name), conf.of(team));

  // the Kolo's tables: both teams of every table
  const kolo = `Kolo ${tables[0].roundNumber}`;
  await page.getByRole("tab", {name: kolo}).click();
  const panel = page.getByRole("tabpanel", {name: kolo});
  // every table opens its scorepad; the player's own one is Započni igru
  await expect(panel.getByRole("link", {name: /^Stol \d+: /}).or(panel.getByRole("button", {name: /^Stol \d+: /}))).toHaveCount(4);
  for (const team of liga.teams) await expectDot(panel.getByRole("link", {name: `Ekipa ${team.name}`, exact: true}), conf.of(team));
  await healthy(page);
});

test("Započni igru on Početna shows the two teams' conference colors, the player's own team first on both sides of the table", async ({as, db, liga, healthy}) => {
  const conf = await addConferences(liga);
  const tables = await publishKolo(liga, db);
  // Bura's table: the round's team1 and team2 come from the pairing; each side's phone lists its own team first
  const table = tables.find((t) => t.team1 === liga.teams[0].id || t.team2 === liga.teams[0].id)!;
  const team = (id: number) => liga.teams.find((t) => t.id === id)!;
  const [one, two] = [team(table.team1), team(table.team2)];
  expect(conf.of(one).name, "the table's teams are in different conferences, so the order shows").not.toBe(conf.of(two).name);

  for (const [mine, opponent] of [
    [one, two],
    [two, one],
  ]) {
    const page = await as(mine.players[0].username);
    await page.goto("/");
    const card = page.getByRole("button", {name: new RegExp(`^STOL ${table.tableNumber} .*Započni igru$`)});
    await expect(card).toBeVisible();
    await expect(card).toHaveAccessibleName(
      new RegExp(`${escape(conf.of(mine).name)} ${escape(mine.name)} ${escape(conf.of(opponent).name)} ${escape(opponent.name)} Započni igru$`),
    );
    const dots = card.getByRole("img");
    await expect(dots).toHaveCount(2);
    for (const [i, t] of [mine, opponent].entries()) {
      await expect(dots.nth(i)).toHaveAccessibleName(conf.of(t).name);
      await expect(dots.nth(i)).toHaveCSS("background-color", rgb(conf.of(t).color));
    }
    await healthy(page);
  }
});
