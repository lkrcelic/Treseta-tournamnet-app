// L · A league's place (Zadano lige) and a night's own place. Every night of "E2E · Dvije lokacije" follows the
// league's place, Caffe bar Pitanik, until the admin's Uredi večer (Datumi on the phone) gives next week's night its own,
// Klub Dubrava, and takes it back with Zadano lige; Raspored and Početna's next night show which place each night has,
// with its address and map. Next week's night, so it runs the same at any hour (Početna and Datumi count by the
// calendar).
import type {Page} from "@playwright/test";
import {expect, nightLabel, test, type Liga, type Place} from "../../helpers/l";
import {escape} from "../../helpers/scorepad";

// Početna · Liga's card for the team's next night: the place with the start, its address and Karta
async function expectHomePlace(page: Page, place: Place) {
  await page.goto("/");
  const card = page.getByRole("region", {name: "Sljedeća večer"});
  await expect(card).toContainText(`00:00 · ${place.name}`);
  await expect(card).toContainText(place.address);
  await expect(card.getByRole("link", {name: `Karta: ${place.name}`})).toHaveAttribute("href", place.url);
  // one place: no "Vaša lokacija"
  await expect(card).not.toContainText("Vaša lokacija");
}

// Raspored: a night's row reads "00:00 · <place>", marked "!" when the night has its own place
async function expectScheduleRow(page: Page, night: string, place: Place, own: boolean) {
  const row = page.getByRole("listitem").filter({hasText: nightLabel(night)});
  await expect(row).toContainText(`00:00 · ${place.name}`);
  await expect(row.getByRole("img", {name: "Drugo vrijeme ili mjesto"})).toHaveCount(own ? 1 : 0);
}

// Datumi → the night → Uredi večer, on the admin's phone
async function openNight(page: Page, liga: Liga, night: string) {
  await page.goto(`/league/${liga.id}/manage?view=dates`);
  await page.getByRole("list", {name: "Večeri lige"}).getByRole("button", {name: new RegExp(`^${escape(nightLabel(night))}, `)}).click();
  const sheet = page.getByRole("dialog", {name: `Uredi večer · ${nightLabel(night)}`});
  await expect(sheet).toBeVisible();
  return sheet;
}

test("a night plays at the league's place until Uredi večer gives it its own, and Raspored and Početna show which", async ({as, db, liga, healthy}) => {
  const {pitanik, dubrava, nextWeek, weekAfter} = liga;
  const player = await as(liga.teams.A.players[0]);

  // Zadano lige: every night at Caffe bar Pitanik
  await expectHomePlace(player, pitanik);
  await player.goto(`/raspored?league=${liga.id}`);
  const card = player.getByRole("region", {name: "Sljedeća večer"});
  await expect(card.getByRole("link", {name: `00:00 · ${pitanik.name}, otvori kartu`})).toHaveAttribute("href", pitanik.url);
  await expectScheduleRow(player, nextWeek, pitanik, false);
  await expectScheduleRow(player, weekAfter, pitanik, false);

  // the admin gives next week's night its own place
  const admin = await as("admin");
  let sheet = await openNight(admin, liga, nextWeek);
  const mode = sheet.getByRole("radiogroup", {name: "Mjesto večeri"});
  await expect(mode.getByRole("radio", {name: "Zadano lige"})).toBeChecked();
  await expect(sheet).toContainText(pitanik.name);
  await expect(sheet).toContainText(pitanik.address);
  await mode.getByRole("radio", {name: "Drugo mjesto"}).click();
  await sheet.getByRole("button", {name: "Lokacija večeri"}).click();
  const options = sheet.getByRole("listbox", {name: "Lokacije"}).getByRole("option");
  // the league's own place isn't offered as the night's own
  await expect(options.filter({hasText: pitanik.name})).toHaveCount(0);
  await options.filter({hasText: dubrava.name}).click();
  await expect(sheet.getByRole("button", {name: "Lokacija večeri"})).toContainText(dubrava.name);
  await sheet.getByRole("button", {name: "Spremi"}).click();
  await expect(sheet.getByRole("button", {name: "Spremljeno ✓"})).toBeVisible();
  const own = await db.leagueNight.findMany({where: {league_id: liga.id}, orderBy: {night: "asc"}});
  expect(own.map((n) => [n.night.toISOString().slice(0, 10), n.location_id, n.second_location_id])).toEqual([
    [liga.lastWeek, null, null],
    [nextWeek, dubrava.id, null],
    [weekAfter, null, null],
  ]);
  await sheet.getByRole("button", {name: "Zatvori"}).click();
  await expect(admin.getByRole("list", {name: "Večeri lige"}).getByRole("button", {name: new RegExp(`^${escape(nightLabel(nextWeek))}, 00:00 · ${escape(dubrava.name)} \\(drugo mjesto\\): `)})).toBeVisible();
  await healthy(admin);

  // Početna and Raspored: next week at Klub Dubrava, the week after still at the league's place
  await expectHomePlace(player, dubrava);
  await player.goto(`/raspored?league=${liga.id}`);
  await expect(card.getByRole("link", {name: `00:00 · ${dubrava.name}, otvori kartu`})).toHaveAttribute("href", dubrava.url);
  await expectScheduleRow(player, nextWeek, dubrava, true);
  await expectScheduleRow(player, weekAfter, pitanik, false);
  await healthy(player);

  // Zadano lige again: the night follows the league's place
  sheet = await openNight(admin, liga, nextWeek);
  await expect(mode.getByRole("radio", {name: "Drugo mjesto"})).toBeChecked();
  await mode.getByRole("radio", {name: "Zadano lige"}).click();
  await sheet.getByRole("button", {name: "Spremi"}).click();
  await expect(sheet.getByRole("button", {name: "Spremljeno ✓"})).toBeVisible();
  expect((await db.leagueNight.findUniqueOrThrow({where: {league_id_night: {league_id: liga.id, night: new Date(nextWeek)}}})).location_id).toBeNull();
  await expectHomePlace(player, pitanik);
});
