// L · A league night at two places, on the admin's phone. Uredi večer adds the night's second place (Druga lokacija)
// and Podjela ekipa puts each team at one place or the other (the move menu, Zamijeni, back to Neraspoređene, Kopiraj
// raspored); then on tonight's two-place night each place makes, approves and publishes its own Kola (Novo kolo, Skica
// kola, Objavi) on the night's shared Kolo numbers, and Dnevni poredak shows Sve or one place. League "E2E · Dvije
// lokacije" (helpers/l.ts): A–D at Caffe bar Pitanik, E–G at Klub Dubrava, H not placed.
import type {Locator, Page} from "@playwright/test";
import {AT_FIRST, AT_SECOND, expect, KEYS, nightLabel, SPLIT, test, type Key, type Liga} from "../../helpers/l";
import {escape} from "../../helpers/scorepad";

// a place's tab: "Caffe bar Pitanik · 4" (its teams: Podjela, Novo kolo) or "… · skica čeka" (how its Kola go: Skica)
const placeTab = (scope: Page | Locator, name: string, n?: number) =>
  scope.getByRole("tablist", {name: "Lokacija"}).getByRole("tab", {name: new RegExp(`^${escape(name)}\\s*· ${n ?? ".+"}$`)});

test("Uredi večer adds the night's second place, and Podjela puts each team at one place or the other", async ({as, db, liga, healthy}) => {
  const {pitanik, dubrava, nextWeek, teams} = liga;
  const page = await as("admin");

  // Datumi → next week's night → Dodaj drugu lokaciju: the picker opens without the night's first place
  await page.goto(`/league/${liga.id}/manage?view=dates`);
  await page.getByRole("list", {name: "Večeri lige"}).getByRole("button", {name: new RegExp(`^${escape(nightLabel(nextWeek))}, `)}).click();
  const sheet = page.getByRole("dialog", {name: `Uredi večer · ${nightLabel(nextWeek)}`});
  await sheet.getByRole("button", {name: "Dodaj drugu lokaciju"}).click();
  const options = sheet.getByRole("listbox", {name: "Lokacije"}).getByRole("option");
  await expect(options.filter({hasText: dubrava.name})).toHaveCount(1);
  await expect(options.filter({hasText: pitanik.name})).toHaveCount(0);
  await options.filter({hasText: dubrava.name}).click();
  await expect(sheet.getByRole("button", {name: "Druga lokacija"})).toContainText(dubrava.name);
  await expect(sheet).toContainText("Vrijeme je isto na obje lokacije.");
  await expect(sheet).toContainText("Ekipe raspoređuješ u Podjeli ekipa (Večer lige).");
  await sheet.getByRole("button", {name: "Spremi"}).click();
  await expect(sheet.getByRole("button", {name: "Spremljeno ✓"})).toBeVisible();
  const night = await db.leagueNight.findUniqueOrThrow({where: {league_id_night: {league_id: liga.id, night: new Date(nextWeek)}}});
  expect([night.location_id, night.second_location_id]).toEqual([null, dubrava.id]);
  await sheet.getByRole("button", {name: "Zatvori"}).click();
  await expect(
    page.getByRole("list", {name: "Večeri lige"}).getByRole("button", {name: new RegExp(`^${escape(nightLabel(nextWeek))}, 00:00 · ${escape(pitanik.name)} · ${escape(dubrava.name)} \\(dvije lokacije\\): `)}),
  ).toBeVisible();

  // Podjela ekipa: the next night's teams, none placed yet
  await page.goto(`/league/${liga.id}/manage?view=split`);
  await expect(page.getByRole("heading", {name: "Podjela ekipa"})).toBeVisible();
  await expect(page.getByText(`${liga.name} · ${nightLabel(nextWeek)}`)).toBeVisible();
  const waiting = page.getByRole("region", {name: "Neraspoređene"});
  const card = (scope: Locator, k: Key, where: string) => scope.getByRole("button", {name: `Premjesti ${teams[k].name} (${where})`});
  for (const k of KEYS) await expect(card(waiting, k, "neraspoređena")).toBeVisible();
  await expect(placeTab(page, pitanik.name, 0)).toBeVisible();
  await expect(placeTab(page, dubrava.name, 0)).toBeVisible();

  // the move menu: "<team> idu na" a place
  const move = async (k: Key, from: string, to: string) => {
    await page.getByRole("button", {name: `Premjesti ${teams[k].name} (${from})`}).click();
    const menu = page.getByRole("menu", {name: `${teams[k].name} idu na`});
    await menu.getByRole("menuitem", {name: new RegExp(`^${escape(to)}`)}).click();
    await expect(menu).toBeHidden();
  };
  for (const k of AT_FIRST) await move(k, "neraspoređena", pitanik.name);
  for (const k of AT_SECOND) await move(k, "neraspoređena", dubrava.name);
  await expect(placeTab(page, pitanik.name, 4)).toBeVisible();
  await expect(placeTab(page, dubrava.name, 3)).toBeVisible();
  await expect(waiting.getByRole("button", {name: /^Premjesti /})).toHaveCount(1);
  await expect(card(waiting, "H", "neraspoređena")).toBeVisible();
  // the place's tab lists its teams
  await placeTab(page, dubrava.name).click();
  const panel = page.getByRole("tabpanel", {name: dubrava.name});
  for (const k of AT_SECOND) await expect(card(panel, k, dubrava.name)).toBeVisible();
  await expect(panel.getByRole("button", {name: /^Premjesti /})).toHaveCount(3);

  const saved = async () =>
    Object.fromEntries(
      (await db.leagueNightTeam.findMany({where: {league_id: liga.id, night: new Date(nextWeek)}})).map((r) => [KEYS.find((k) => teams[k].id === r.team_id)!, r.slot]),
    );
  await expect.poll(saved).toEqual(SPLIT);

  // Zamijeni: every placed team goes to the other place, H stays where it was
  await page.getByRole("button", {name: "Zamijeni"}).click();
  await expect(placeTab(page, pitanik.name, 3)).toBeVisible();
  await expect(placeTab(page, dubrava.name, 4)).toBeVisible();
  await expect.poll(saved).toEqual(Object.fromEntries(Object.entries(SPLIT).map(([k, s]) => [k, 3 - s!])));
  await page.getByRole("button", {name: "Zamijeni"}).click();
  await expect(placeTab(page, pitanik.name, 4)).toBeVisible();
  await expect.poll(saved).toEqual(SPLIT);

  // a team goes back to Neraspoređene
  await placeTab(page, pitanik.name).click();
  await move("D", pitanik.name, "Neraspoređene");
  await expect(placeTab(page, pitanik.name, 3)).toBeVisible();
  await expect(card(waiting, "D", "neraspoređena")).toBeVisible();
  const {D: _, ...withoutD} = SPLIT;
  await expect.poll(saved).toEqual(withoutD);

  // Kopiraj raspored: each place and its teams, one per line, Neraspoređene left out
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", {name: "Kopiraj raspored"}).click();
  await expect(page.getByRole("button", {name: "Kopirano"})).toBeVisible();
  const lines = (keys: Key[]) => keys.map((k) => `• ${teams[k].name}`);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    [pitanik.name, ...lines(["A", "B", "C"]), "", dubrava.name, ...lines(["E", "F", "G"])].join("\n"),
  );
  await healthy(page);
});

// Večer lige → the league
async function openTonight(page: Page, liga: Liga) {
  await page.goto("/");
  await expect(page.getByRole("heading", {name: "Večer lige"})).toBeVisible();
  const picker = page.getByRole("button", {name: `Liga: ${liga.name}. Promijeni ligu`});
  if (!(await picker.isVisible())) {
    await page.getByRole("button", {name: /^Liga: .*\. Promijeni ligu$/}).click();
    await page.getByRole("dialog", {name: "Odaberi ligu"}).getByRole("option", {name: new RegExp(`^${escape(liga.name)} `)}).click();
  }
  await expect(picker).toBeVisible();
  return page.getByRole("region", {name: "Večeras"});
}

test("each place makes, approves and publishes its own Kola on the night's Kolo numbers, and Dnevni poredak shows each place", async ({as, liga, healthy}) => {
  test.setTimeout(120_000);
  const {pitanik, dubrava, tonight, teams} = liga;
  await liga.night(tonight, {second: true, split: SPLIT, arrived: [...AT_FIRST, ...AT_SECOND]});
  const mine = new Set(KEYS.map((k) => teams[k].id));
  const atFirst = new Set(AT_FIRST.map((k) => teams[k].id));
  const atSecond = new Set(AT_SECOND.map((k) => teams[k].id));

  // Večer lige: a box per place with its teams and how many are here, and the team without a place
  const page = await as("admin");
  let evening = await openTonight(page, liga);
  await expect(evening).toContainText("Kola još nisu kreirana");
  await expect(evening.getByRole("region", {name: pitanik.name})).toContainText("4 ekipe · 4 tu");
  await expect(evening.getByRole("region", {name: dubrava.name})).toContainText("3 ekipe · 3 tu");
  await expect(evening.getByRole("button", {name: "1 ekipa bez lokacije vidi „Javi se adminu”"})).toBeVisible();
  await evening.getByRole("button", {name: "Novo kolo", exact: true}).click();

  // Novo kolo at Caffe bar Pitanik: its four teams, two Kola
  await expect(page.getByRole("heading", {name: "Novo kolo"})).toBeVisible();
  await expect(placeTab(page, pitanik.name, 4)).toHaveAttribute("aria-selected", "true");
  await expect(placeTab(page, dubrava.name, 3)).toHaveAttribute("aria-selected", "false");
  const who = page.getByRole("region", {name: "Tko igra večeras"});
  await expect(who.getByRole("status")).toHaveText(new RegExp(`^4 / 4\\s*ekipe igraju večeras · ${escape(pitanik.name)}$`));
  await page.getByRole("radiogroup", {name: "Broj kola večeras"}).getByRole("radio", {name: "2", exact: true}).click();
  await page.getByRole("button", {name: "Kreiraj 2 kola · 2 stola"}).click();

  // Skica kola at Caffe bar Pitanik: Skica A and B, two tables each from Stol 1, all of them its teams
  await expect(page.getByRole("heading", {name: "Skica kola"})).toBeVisible();
  await expect(placeTab(page, pitanik.name)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", {name: "Skica A, stolovi"}).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText(`Objava vrijedi samo za lokaciju ${pitanik.name}.`)).toBeVisible();
  let tables = await liga.tables();
  expect(tables.map((t) => [t.slot, t.status, t.table])).toEqual([
    [1, "DRAFT", 1],
    [1, "DRAFT", 2],
    [1, "DRAFT", 1],
    [1, "DRAFT", 2],
  ]);
  expect(tables.every((t) => atFirst.has(t.team1Id) && atFirst.has(t.team2Id))).toBe(true);
  await page.getByRole("button", {name: "Odobri sva"}).click();
  await page.getByRole("button", {name: "Objavi odobrena kola · 2/2"}).click();
  await expect(page.getByText("Sva kola su objavljena")).toBeVisible();
  // the league's last Kolo was 6
  await expect(page.getByRole("button", {name: "Kolo 7, objavljeno"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Kolo 8, objavljeno"})).toBeVisible();

  // the other place hasn't started: its own Novo kolo from Večer lige
  evening = await openTonight(page, liga);
  await expect(evening.getByRole("region", {name: pitanik.name})).toContainText("kolo 1 od 2");
  await evening.getByRole("region", {name: dubrava.name}).getByRole("button", {name: `Novo kolo · ${dubrava.name}`}).click();
  await expect(placeTab(page, dubrava.name, 3)).toHaveAttribute("aria-selected", "true");
  await expect(who.getByRole("status")).toHaveText(new RegExp(`^3 / 3\\s*ekipe igraju večeras · ${escape(dubrava.name)}$`));
  await page.getByRole("radiogroup", {name: "Broj kola večeras"}).getByRole("radio", {name: "1", exact: true}).click();
  await page.getByRole("button", {name: "Kreiraj 1 kolo · 1 stol"}).click();
  await expect(page.getByRole("heading", {name: "Skica kola"})).toBeVisible();
  await expect(placeTab(page, dubrava.name)).toHaveAttribute("aria-selected", "true");
  // three teams: a table and a bye
  await expect(page.getByRole("list", {name: "Skica A, stolovi"}).getByRole("listitem")).toHaveCount(2);
  await expect(page.getByText(`Objava vrijedi samo za lokaciju ${dubrava.name}.`)).toBeVisible();
  await page.getByRole("button", {name: "Odobri sva"}).click();
  await page.getByRole("button", {name: "Objavi odobrena kola · 1/1"}).click();
  await expect(page.getByText("Sva kola su objavljena")).toBeVisible();
  // its first Kolo of the night has the same number as Caffe bar Pitanik's
  await expect(page.getByRole("button", {name: "Kolo 7, objavljeno"})).toBeVisible();

  tables = await liga.tables();
  const first = tables.filter((t) => t.slot === 1);
  const second = tables.filter((t) => t.slot === 2);
  expect(first.map((t) => [t.status, t.round, t.table])).toEqual([
    ["PUBLISHED", 7, 1],
    ["PUBLISHED", 7, 2],
    ["PUBLISHED", 8, 1],
    ["PUBLISHED", 8, 2],
  ]);
  // Klub Dubrava's Kolo 7: Stol 1 and the bye, its three teams in them
  expect(second.map((t) => [t.status, t.round])).toEqual([
    ["PUBLISHED", 7],
    ["PUBLISHED", 7],
  ]);
  expect(second.filter((t) => mine.has(t.team1Id) && mine.has(t.team2Id)).map((t) => t.table)).toEqual([1]);
  expect(second.flatMap((t) => [t.team1Id, t.team2Id]).filter((id) => atSecond.has(id)).sort()).toEqual([...atSecond].sort());
  const bye = second.find((t) => !mine.has(t.team1Id) || !mine.has(t.team2Id))!;
  const sitter = AT_SECOND.find((k) => teams[k].id === bye.team1Id || teams[k].id === bye.team2Id)!;
  expect(tables.every((t) => t.slot != null)).toBe(true);

  // Dnevni poredak: Sve, then each place's own teams and Kola
  await page.getByRole("button", {name: "Otvori Dnevni poredak"}).click();
  await expect(page).toHaveURL(new RegExp(`/league/${liga.id}/daily-standings\\?date=${tonight}`));
  const filter = page.getByRole("radiogroup", {name: "Lokacija"});
  await expect(filter.getByRole("radio", {name: "Sve"})).toBeChecked();
  await expect(page.getByText("7 ekipa · 2 lokacije")).toBeVisible();
  const gathering = page.getByRole("tabpanel", {name: "Tablica okupljanja"}).getByRole("listitem");
  await expect(gathering).toHaveCount(7);
  const tabs = page.getByRole("tablist", {name: "Prikaz"}).getByRole("tab");
  await expect(tabs).toHaveText(["Tablica okupljanja", "Kolo 7", "Kolo 8"]);
  // the night's one result so far is Klub Dubrava's bye (both matches 5 : 0): first of the whole night
  const rankOf = (k: Key, rank: number) => gathering.filter({hasText: teams[k].name}).getByLabel(`${rank}. mjesto`, {exact: true});
  await expect(rankOf(sitter, 1)).toHaveCount(1);
  for (const k of AT_FIRST) await expect(rankOf(k, 1)).toHaveCount(0);

  // Kolo 7 in Sve: each place's tables under its name, each from Stol 1
  await page.getByRole("tab", {name: "Kolo 7"}).click();
  const kolo7 = page.getByRole("tabpanel", {name: "Kolo 7"});
  await expect(kolo7.getByText(`Kolo 7 · ${pitanik.name}`)).toBeVisible();
  await expect(kolo7.getByText(`Kolo 7 · ${dubrava.name}`)).toBeVisible();
  // the bye isn't a table; the three tables are links to their scorepads
  const played = tables.filter((t) => t.round === 7 && mine.has(t.team1Id) && mine.has(t.team2Id));
  expect(played).toHaveLength(3);
  for (const t of played) {
    await expect(kolo7.getByRole("link", {name: new RegExp(`^Stol ${t.table}: ${escape(t.team1)} 0, ${escape(t.team2)} 0, `)})).toHaveCount(1);
  }
  await expect(kolo7.getByRole("link", {name: /^Stol 1: /})).toHaveCount(2);

  // Klub Dubrava: its three teams, the bye's team first, and only its own Kolo
  await page.getByRole("tab", {name: "Tablica okupljanja"}).click();
  await filter.getByRole("radio", {name: dubrava.name}).click();
  await expect(filter.getByRole("radio", {name: dubrava.name})).toBeChecked();
  await expect(gathering).toHaveCount(3);
  await expect(page.getByText("3 ekipe", {exact: true})).toBeVisible();
  for (const k of AT_SECOND) await expect(gathering.filter({hasText: teams[k].name})).toHaveCount(1);
  await expect(tabs).toHaveText(["Tablica okupljanja", "Kolo 7"]);

  await expect(rankOf(sitter, 1)).toHaveCount(1);

  // Caffe bar Pitanik: its four teams ranked from 1 (none of them is first of the whole night), and both of its Kola
  await filter.getByRole("radio", {name: pitanik.name}).click();
  await expect(gathering).toHaveCount(4);
  for (const k of AT_FIRST) await expect(gathering.filter({hasText: teams[k].name})).toHaveCount(1);
  await expect(gathering.first().getByLabel("1. mjesto", {exact: true})).toHaveCount(1);
  await expect(tabs).toHaveText(["Tablica okupljanja", "Kolo 7", "Kolo 8"]);
  await healthy(page);
});
