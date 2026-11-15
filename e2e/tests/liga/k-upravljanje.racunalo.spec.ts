// K · the admin edits a league's conferences on the computer, Upravljanje ligom: Podaci's Konferencije card (add,
// name, color, rename, delete) and Ekipe (a team's conference picker, the filter, Rasporedi ravnomjerno). The rules
// (docs/arhiva/CONFERENCES_PLAN.md, src/app/_lib/conferences.ts): a league has none or 2–6 conferences, names unique in
// any case, colors from the palette and unique; picking another row's color swaps the two; a deleted conference
// leaves its teams without one, which is asked first; Rasporedi ravnomjerno deals the teams out in snake order of the
// table and replaces earlier assignments. Each test has its own league (helpers/k.ts), removed afterwards.
import type {Db} from "../../helpers/db";
import {COLORS, LEAGUE_NAME, SNAKE, addConferences, expect, test, type Liga} from "../../helpers/k";

const conferencesIn = (db: Db, liga: Liga) =>
  db.conference.findMany({where: {league_id: liga.id}, orderBy: {position: "asc"}, select: {conference_id: true, name: true, color: true, position: true}});

// each team's conference id, by team name
const assignments = async (db: Db, liga: Liga) =>
  Object.fromEntries(
    (await db.leagueTeam.findMany({where: {league_id: liga.id}, include: {team: true}})).map((lt) => [lt.team.team_name, lt.conference_id]),
  );

const byRanks = (liga: Liga, ranks: readonly number[]) => liga.teams.filter((t) => ranks.includes(t.rank)).map((t) => t.name);

test("the admin adds two conferences with their names and colors on Podaci, and the editor refuses what a league can't have", async ({as, db, liga, healthy}) => {
  const page = await as("admin");
  await page.goto(`/league/${liga.id}/manage?view=details`);
  const card = page.getByRole("region", {name: "Konferencije"});
  await card.getByRole("button", {name: "Dodaj konferencije"}).click();

  // two rows in the palette's first two colors; two is the least, so neither row can be taken away
  const name1 = card.getByRole("textbox", {name: "Ime konferencije 1"});
  const name2 = card.getByRole("textbox", {name: "Ime konferencije 2"});
  await expect(card.getByRole("radiogroup", {name: "Boja: Konferencija 1"}).getByRole("radio", {name: "plava"})).toBeChecked();
  await expect(card.getByRole("radiogroup", {name: "Boja: Konferencija 2"}).getByRole("radio", {name: "narančasta"})).toBeChecked();
  await expect(card.getByRole("button", {name: "Ukloni: Konferencija 1"})).toBeDisabled();
  await expect(card.getByRole("button", {name: "Ukloni: Konferencija 2"})).toBeDisabled();
  const save = card.getByRole("button", {name: "Spremi", exact: true});
  const alert = card.getByRole("alert");

  // a name each, never the same one (in any case)
  await name1.fill("Sjever");
  await expect(alert).toHaveText("Svaka konferencija treba ime.");
  await expect(save).toBeDisabled();
  await name2.fill(" SJEVER");
  await expect(alert).toHaveText("Dvije konferencije ne mogu imati isto ime.");
  await expect(save).toBeDisabled();
  await name2.fill("Jug");
  await expect(alert).toBeHidden();
  await expect(save).toBeEnabled();

  // a color taken by the other row swaps the two, so two conferences never share one
  const sjever = card.getByRole("radiogroup", {name: "Boja: Sjever"});
  const jug = card.getByRole("radiogroup", {name: "Boja: Jug"});
  await jug.getByRole("radio", {name: "plava"}).click();
  await expect(jug.getByRole("radio", {checked: true})).toHaveAccessibleName("plava");
  await expect(sjever.getByRole("radio", {checked: true})).toHaveAccessibleName("narančasta");
  await jug.getByRole("radio", {name: "tirkizna"}).click();
  await sjever.getByRole("radio", {name: "plava"}).click();
  await expect(sjever.getByRole("radio", {checked: true})).toHaveAccessibleName("plava");
  await expect(jug.getByRole("radio", {checked: true})).toHaveAccessibleName("tirkizna");
  await expect(alert).toBeHidden();

  await save.click();
  await expect(card.getByRole("button", {name: "Spremljeno ✓"})).toBeVisible();
  const saved = await conferencesIn(db, liga);
  expect(saved.map((c) => [c.name, c.color, c.position])).toEqual([
    ["Sjever", COLORS.plava, 0],
    ["Jug", COLORS.tirkizna, 1],
  ]);

  // saved: the card shows them again after a reload
  await page.reload();
  await expect(name1).toHaveValue("Sjever");
  await expect(name2).toHaveValue("Jug");
  await expect(sjever.getByRole("radio", {checked: true})).toHaveAccessibleName("plava");
  await expect(jug.getByRole("radio", {checked: true})).toHaveAccessibleName("tirkizna");
  await healthy(page);

  // the server refuses the same as the editor, and what the editor can't even make: one conference, a shared color
  const refusals: [string, {name: string; color: string}[], string][] = [
    ["one conference", [{name: "Sjever", color: COLORS.plava}], "Liga treba barem 2 konferencije ili nijednu."],
    ["a shared color", [{name: "Sjever", color: COLORS.plava}, {name: "Jug", color: COLORS.plava}], "Dvije konferencije ne mogu imati istu boju."],
    ["the same name", [{name: "Sjever", color: COLORS.plava}, {name: " sjever ", color: COLORS.tirkizna}], "Dvije konferencije ne mogu imati isto ime."],
    ["a color off the palette", [{name: "Sjever", color: "#FF0000"}, {name: "Jug", color: COLORS.tirkizna}], "Svakoj konferenciji odaberi boju iz palete."],
  ];
  for (const [what, conferences, message] of refusals) {
    const res = await liga.admin.put(`/api/leagues/${liga.id}/conferences`, {data: {conferences}});
    expect(res.status(), what).toBe(400);
    expect(((await res.json()) as {error: string}).error, what).toBe(message);
  }
  expect(await conferencesIn(db, liga)).toEqual(saved);
});

test("the admin puts a team in a conference, and Rasporedi ravnomjerno deals all eight out in snake order of the table", async ({as, db, liga, healthy}) => {
  const {sjever, jug} = await addConferences(liga, {assign: false});
  const page = await as("admin");
  await page.goto(`/league/${liga.id}/manage?view=teams`);
  const list = page.getByRole("region", {name: `Ekipe lige ${LEAGUE_NAME}`});
  const pickers = list.getByRole("button", {name: /\. Promijeni konferenciju$/});
  const filter = page.getByRole("radiogroup", {name: "Konferencija ekipa"});
  const perConference = page.getByRole("region", {name: "Ekipe po konferencijama"}).getByRole("listitem");

  // no team has a conference yet
  await expect(pickers).toHaveCount(8);
  for (const t of liga.teams) await expect(list.getByRole("button", {name: `${t.name}: bez konferencije. Promijeni konferenciju`})).toBeVisible();
  await expect(filter.getByRole("radio")).toHaveText([/^Sve\s*8$/, /^Sjever\s*0$/, /^Jug\s*0$/, /^Bez konferencije\s*8$/]);
  await expect(perConference).toHaveText([/^Sjever\s*0$/, /^Jug\s*0$/, /^Bez konferencije\s*8$/]);

  // Levant (3rd) into Sjever from its picker; the filter's Sjever then lists it alone
  const levant = liga.teams[2];
  await list.getByRole("button", {name: `${levant.name}: bez konferencije. Promijeni konferenciju`}).click();
  await page.getByRole("listbox", {name: `Konferencija: ${levant.name}`}).getByRole("option", {name: "Sjever"}).click();
  await expect(list.getByRole("button", {name: `${levant.name}: konferencija Sjever. Promijeni konferenciju`})).toBeVisible();
  await expect.poll(async () => (await assignments(db, liga))[levant.name]).toBe(sjever.id);
  await filter.getByRole("radio", {name: /^Sjever/}).click();
  await expect(pickers).toHaveCount(1);
  await expect(pickers).toHaveAccessibleName(`${levant.name}: konferencija Sjever. Promijeni konferenciju`);
  await filter.getByRole("radio", {name: /^Sve/}).click();
  await expect(pickers).toHaveCount(8);
  await expect(perConference).toHaveText([/^Sjever\s*1$/, /^Jug\s*0$/, /^Bez konferencije\s*7$/]);

  // Rasporedi ravnomjerno: asked first, then the table dealt out 1 → Sjever, 2, 3 → Jug, 4, 5 → Sjever … replacing
  // Levant's Sjever with Jug
  await page.getByRole("button", {name: "Rasporedi ravnomjerno"}).click();
  await expect(page.getByText("Raspoređuje se 8 ekipa po poretku lige: Sjever 4 · Jug 4. Ovo zamjenjuje njihove dosadašnje konferencije.")).toBeVisible();
  await page.getByRole("button", {name: "Rasporedi", exact: true}).click();
  await expect(perConference).toHaveText([/^Sjever\s*4$/, /^Jug\s*4$/]);
  const expected = Object.fromEntries([...byRanks(liga, SNAKE.first).map((n) => [n, sjever.id]), ...byRanks(liga, SNAKE.second).map((n) => [n, jug.id])]);
  expect(await assignments(db, liga)).toEqual(expected);
  for (const name of byRanks(liga, SNAKE.first)) await expect(list.getByRole("button", {name: `${name}: konferencija Sjever. Promijeni konferenciju`})).toBeVisible();
  for (const name of byRanks(liga, SNAKE.second)) await expect(list.getByRole("button", {name: `${name}: konferencija Jug. Promijeni konferenciju`})).toBeVisible();
  // every team has one now, so the filter has no Bez konferencije
  await expect(filter.getByRole("radio")).toHaveText([/^Sve\s*8$/, /^Sjever\s*4$/, /^Jug\s*4$/]);
  await filter.getByRole("radio", {name: /^Jug/}).click();
  await expect(pickers).toHaveCount(4);
  await healthy(page);
});

test("the admin renames a conference, adds a third and deletes one, whose teams are left without a conference", async ({as, db, liga, healthy}) => {
  const {sjever, jug} = await addConferences(liga);
  const page = await as("admin");
  await page.goto(`/league/${liga.id}/manage?view=details`);
  const card = page.getByRole("region", {name: "Konferencije"});
  await expect(card.getByRole("textbox", {name: "Ime konferencije 2"})).toHaveValue("Jug");

  // Jug becomes Jadran (the same conference, its teams stay), and a third, Zapad, takes the first free color
  await card.getByRole("textbox", {name: "Ime konferencije 2"}).fill("Jadran");
  await card.getByRole("button", {name: "Dodaj konferenciju"}).click();
  await card.getByRole("textbox", {name: "Ime konferencije 3"}).fill("Zapad");
  await expect(card.getByRole("radiogroup", {name: "Boja: Zapad"}).getByRole("radio", {checked: true})).toHaveAccessibleName("narančasta");
  await card.getByRole("button", {name: "Spremi", exact: true}).click();
  await expect(card.getByRole("button", {name: "Spremljeno ✓"})).toBeVisible();
  const renamed = await conferencesIn(db, liga);
  expect(renamed.map((c) => [c.name, c.color, c.position])).toEqual([
    ["Sjever", COLORS.plava, 0],
    ["Jadran", COLORS.tirkizna, 1],
    ["Zapad", COLORS.narančasta, 2],
  ]);
  expect(renamed.slice(0, 2).map((c) => c.conference_id)).toEqual([sjever.id, jug.id]);
  const jugTeams = byRanks(liga, SNAKE.second);
  const sjeverTeams = byRanks(liga, SNAKE.first);
  expect(Object.entries(await assignments(db, liga)).filter(([, id]) => id === jug.id).map(([n]) => n).sort()).toEqual([...jugTeams].sort());

  // Sjever out: with three rows any can go; it has four teams, so Spremi asks first and nothing is saved yet
  await card.getByRole("button", {name: "Ukloni: Sjever"}).click();
  await card.getByRole("button", {name: "Spremi", exact: true}).click();
  await expect(card.getByRole("alert")).toHaveText("Sjever ima 4 ekipe. Ostat će bez konferencije. Spremi ponovno za nastavak.");
  expect(await db.conference.count({where: {conference_id: sjever.id}})).toBe(1);
  await card.getByRole("button", {name: "Svejedno spremi"}).click();
  await expect(card.getByRole("button", {name: "Spremljeno ✓"})).toBeVisible();
  const left = await conferencesIn(db, liga);
  expect(left.map((c) => [c.name, c.color, c.position])).toEqual([
    ["Jadran", COLORS.tirkizna, 0],
    ["Zapad", COLORS.narančasta, 1],
  ]);
  const after = await assignments(db, liga);
  expect(Object.fromEntries(Object.entries(after).sort())).toEqual(
    Object.fromEntries([...sjeverTeams.map((n) => [n, null]), ...jugTeams.map((n) => [n, jug.id])].sort()),
  );

  // Ekipe: Sjever's teams have no conference, Jadran's kept theirs
  await page.getByRole("tablist", {name: "Prikaz"}).getByRole("tab", {name: /^Ekipe/}).click();
  const list = page.getByRole("region", {name: `Ekipe lige ${LEAGUE_NAME}`});
  for (const name of sjeverTeams) await expect(list.getByRole("button", {name: `${name}: bez konferencije. Promijeni konferenciju`})).toBeVisible();
  for (const name of jugTeams) await expect(list.getByRole("button", {name: `${name}: konferencija Jadran. Promijeni konferenciju`})).toBeVisible();
  await expect(page.getByRole("radiogroup", {name: "Konferencija ekipa"}).getByRole("radio")).toHaveText([
    /^Sve\s*8$/,
    /^Jadran\s*4$/,
    /^Zapad\s*0$/,
    /^Bez konferencije\s*4$/,
  ]);
  await healthy(page);
});
