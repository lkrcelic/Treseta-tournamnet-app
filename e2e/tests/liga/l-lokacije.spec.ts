// L · Admin · Lokacije on the phone (/lokacije): the one list of places that leagues, nights and tournaments point at.
// A place is added, changed and deleted from its sheet; one in use (places.pitanik: the leagues and tournaments) can't
// be deleted, on the screen or through the API. The places a test adds are named "L · …" and removed afterwards.
import {expect, test, count, PREFIX} from "../../helpers/l";

test.beforeEach(async ({places}) => places);

test("the admin adds a place, changes it, and deletes it while nothing uses it", async ({as, db, world, healthy}) => {
  const added = {name: `${PREFIX}Kod Mate`, address: "Vlaška 70, Zagreb", url: "https://maps.app.goo.gl/e2eKodMate"};
  const changed = {name: `${PREFIX}Kod Mate i Ane`, address: "Vlaška 72, Zagreb"};

  const page = await as("admin");
  await page.goto("/lokacije");
  await expect(page.getByRole("heading", {name: "Lokacije", level: 1})).toBeVisible();
  const list = page.getByRole("list", {name: "Sve lokacije"});
  const row = (name: string) => list.getByRole("listitem").filter({has: page.getByText(name, {exact: true})});
  await expect(row(world.places.pitanik.name)).toHaveCount(1);
  await expect(row(world.places.dubrava.name)).toHaveCount(1);

  // Dodaj lokaciju: Ime mjesta, Adresa and Link na Google Mape, and Otvori karta for the link typed
  await page.getByRole("button", {name: "Dodaj lokaciju"}).click();
  const sheet = page.getByRole("dialog", {name: "Nova lokacija"});
  await sheet.getByLabel("Ime mjesta").fill(added.name);
  await sheet.getByLabel("Adresa").fill(added.address);
  await sheet.getByLabel("Link na Google Mape").fill(added.url);
  await expect(sheet.getByRole("link", {name: /^Otvori kartu/})).toHaveAttribute("href", added.url);
  await sheet.getByRole("button", {name: "Dodaj", exact: true}).click();
  await expect(sheet).toBeHidden();
  await expect(row(added.name)).toContainText(added.address);
  await expect(row(added.name)).toContainText("Nije u upotrebi");
  const saved = await db.location.findFirstOrThrow({where: {name: added.name}});
  expect([saved.address, saved.url]).toEqual([added.address, added.url]);

  // Uredi lokaciju: the fields as saved; a new name and address
  await row(added.name).getByRole("button").click();
  const edit = page.getByRole("dialog", {name: "Uredi lokaciju"});
  await expect(edit.getByLabel("Ime mjesta")).toHaveValue(added.name);
  await expect(edit.getByLabel("Adresa")).toHaveValue(added.address);
  await expect(edit.getByLabel("Link na Google Mape")).toHaveValue(added.url);
  await edit.getByLabel("Ime mjesta").fill(changed.name);
  await edit.getByLabel("Adresa").fill(changed.address);
  await edit.getByRole("button", {name: "Spremi"}).click();
  await expect(edit).toBeHidden();
  await expect(row(changed.name)).toContainText(changed.address);
  await expect(row(added.name)).toHaveCount(0);
  const updated = await db.location.findUniqueOrThrow({where: {location_id: saved.location_id}});
  expect([updated.name, updated.address, updated.url]).toEqual([changed.name, changed.address, added.url]);

  // Obriši: nothing uses it, so it isn't locked; the question names it
  await row(changed.name).getByRole("button").click();
  await expect(edit.getByLabel("Ime mjesta")).toHaveValue(changed.name);
  await expect(edit).not.toContainText("Koristi se");
  await expect(edit.getByRole("button", {name: "Obriši lokaciju"})).toBeEnabled();
  await edit.getByRole("button", {name: "Obriši lokaciju"}).click();
  const ask = page.getByRole("dialog", {name: "Obrisati lokaciju?"});
  await expect(ask).toContainText(`${changed.name} se briše s popisa lokacija.`);
  await ask.getByRole("button", {name: "Obriši", exact: true}).click();
  await expect(ask).toBeHidden();
  await expect(row(changed.name)).toHaveCount(0);
  expect(await db.location.count({where: {location_id: saved.location_id}})).toBe(0);
  await healthy(page);
});

test("a place in use can't be deleted: Obriši is locked with what uses it, and the server refuses", async ({as, api, db, world, healthy}) => {
  const pitanik = world.places.pitanik;
  const place = await db.location.findUniqueOrThrow({where: {location_id: pitanik.id}});
  // what uses it: leagues, nights (as their first or second place) and tournaments
  const leagues = await db.league.count({where: {location_id: pitanik.id}});
  const nights = await db.leagueNight.count({where: {OR: [{location_id: pitanik.id}, {second_location_id: pitanik.id}]}});
  const tournaments = await db.tournament.count({where: {location_id: pitanik.id}});
  expect(leagues + tournaments).toBeGreaterThan(0);
  const uses = [
    leagues && count(leagues, ["liga", "lige", "liga"]),
    nights && count(nights, ["večer", "večeri", "večeri"]),
    tournaments && count(tournaments, ["turnir", "turnira", "turnira"]),
  ]
    .filter(Boolean)
    .join(" · ");

  const page = await as("admin");
  await page.goto("/lokacije");
  const row = page.getByRole("list", {name: "Sve lokacije"}).getByRole("listitem").filter({has: page.getByText(pitanik.name, {exact: true})});
  await expect(row).toContainText(place.address!);
  await expect(row).toContainText(uses);
  await row.getByRole("button").click();
  const edit = page.getByRole("dialog", {name: "Uredi lokaciju"});
  const locked = edit.getByRole("button", {name: "Obriši lokaciju"});
  await expect(locked).toBeDisabled();
  await expect(locked).toHaveAccessibleDescription(`Koristi se: ${uses}. Lokacija se ne može obrisati dok se koristi.`);
  await healthy(page);

  // the API says no as well, and the place stays
  const admin = await api("admin");
  const res = await admin.delete(`/api/locations/${pitanik.id}`);
  expect(res.status()).toBe(400);
  expect(((await res.json()) as {error: string}).error).toBe("Lokacija se koristi, pa se ne može obrisati.");
  expect(await db.location.count({where: {location_id: pitanik.id}})).toBe(1);
});
