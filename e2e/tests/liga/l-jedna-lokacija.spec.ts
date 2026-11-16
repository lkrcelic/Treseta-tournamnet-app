// L · A night at one place works as before Lokacije: no place switch on Novo kolo, Skica kola or Dnevni poredak, no
// Podjela, no slot on its tables (Round.location_slot null), the Kolo numbered after the league's last, and the
// player's table still says which Kolo of the night it is. League "E2E · Dvije lokacije" (helpers/l.ts) with tonight
// at its own place only, every team here (Tu smo).
import {expect, KEYS, test} from "../../helpers/l";

test("a one-place night makes, approves and publishes its Kolo without a place, and writes no slot", async ({as, liga, healthy}) => {
  const {tonight, teams, pitanik} = liga;
  await liga.night(tonight, {arrived: [...KEYS]});

  const page = await as("admin");
  await page.goto(`/league/${liga.id}/manage?view=create`);
  await expect(page.getByRole("heading", {name: "Novo kolo"})).toBeVisible();
  const who = page.getByRole("region", {name: "Tko igra večeras"});
  await expect(who.getByRole("status")).toHaveText(/^8 \/ 8\s*ekipa igra večeras$/);
  await expect(page.getByRole("tablist", {name: "Lokacija"})).toHaveCount(0);
  await page.getByRole("radiogroup", {name: "Broj kola večeras"}).getByRole("radio", {name: "1", exact: true}).click();
  await page.getByRole("button", {name: "Kreiraj 1 kolo · 4 stola"}).click();

  await expect(page.getByRole("heading", {name: "Skica kola"})).toBeVisible();
  await expect(page.getByRole("list", {name: "Skica A, stolovi"}).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("tablist", {name: "Lokacija"})).toHaveCount(0);
  await expect(page.getByText(/^Objava vrijedi samo za lokaciju/)).toHaveCount(0);
  await page.getByRole("button", {name: "Odobri sva"}).click();
  await page.getByRole("button", {name: "Objavi odobrena kola · 1/1"}).click();
  await expect(page.getByText("Sva kola su objavljena")).toBeVisible();
  await expect(page.getByRole("button", {name: "Kolo 7, objavljeno"})).toBeVisible();
  const tables = await liga.tables();
  expect(tables.map((t) => [t.status, t.round, t.table, t.slot])).toEqual([1, 2, 3, 4].map((n) => ["PUBLISHED", 7, n, null]));

  // Dnevni poredak: the night's eight teams, no place switch
  await page.getByRole("button", {name: "Otvori Dnevni poredak"}).click();
  await expect(page.getByRole("tabpanel", {name: "Tablica okupljanja"}).getByRole("listitem")).toHaveCount(8);
  await expect(page.getByRole("radiogroup", {name: "Lokacija"})).toHaveCount(0);
  await healthy(page);

  // no Podjela for a night at one place
  await page.goto(`/league/${liga.id}/manage?view=split`);
  await expect(page.getByText("Sljedeća večer ima jednu lokaciju, pa nema podjele ekipa. Drugu lokaciju dodaješ u Datumima, u Uredi večer.")).toBeVisible();

  // the player's table: Kolo 1 of the night's 1, no place on it
  const a = await as(teams.A.players[0]);
  await a.goto("/");
  const start = a.getByRole("button", {name: /Započni igru/});
  await expect(start).toContainText("Kolo 1/1");
  await expect(start).not.toContainText(pitanik.name);
  await healthy(a);
});
