// C9 · the profile photo on the phone: a player without a photo taps Dodaj sliku on Moj profil, picks a file from the
// gallery, zooms it in "Pomakni i zumiraj" and saves it; the photo is then the player's avatar on Moj profil, in Moje
// ekipe and on the team's page, for the player and for a teammate (the seed's "Ja i suigrači"). Odustani in the crop
// keeps the photo as it was, and Makni sliku in the player's own sheet brings the initials back.
// The photo lives in the section's own database (PlayerPhoto), nothing goes to an outside store. The `me` fixture
// puts the seeded photo back afterwards.
import type {Locator, Page} from "@playwright/test";
import {brightness, expect, loadedWidth, myChip, myRow, photoOf, PICKED_PHOTO, test} from "../../helpers/c9";

// Odaberi iz galerije in the open Profilna slika sheet, the file picked: "Pomakni i zumiraj" opens in its place
async function pickFromGallery(page: Page, sheet: Locator): Promise<Locator> {
  const chooser = page.waitForEvent("filechooser");
  await sheet.getByRole("button", {name: /^Odaberi iz galerije/}).click();
  await (await chooser).setFiles(PICKED_PHOTO);
  const crop = page.getByRole("dialog", {name: "Pomakni i zumiraj"});
  await expect(crop).toBeVisible();
  await expect(sheet).toBeHidden();
  return crop;
}

test("Dodaj sliku: the picked photo goes through the crop and Spremi, and shows on Moj profil, in Moje ekipe and on the team's page", async ({
  as,
  db,
  me,
  healthy,
}) => {
  await me.removePhoto();
  const before = Date.now();
  const page = await as(me.username);
  await page.goto("/profile");

  // no photo: the initials with "Dodaj sliku" under the name
  const hero = page.getByRole("region", {name: me.username});
  await expect(hero.getByRole("button", {name: "Dodaj profilnu sliku"})).toBeVisible();
  await expect(photoOf(hero, me.id)).toHaveCount(0);
  await hero.getByRole("button", {name: "Dodaj sliku"}).click();

  // the sheet offers the camera and the gallery; there is nothing to take away yet
  const sheet = page.getByRole("dialog", {name: "Profilna slika"});
  await expect(sheet.getByRole("button", {name: "Odaberi iz galerije PNG, JPG ili WebP"})).toBeVisible();
  await expect(sheet.getByRole("button", {name: /^Makni sliku/})).toHaveCount(0);

  // "Pomakni i zumiraj": the photo zoomed in all the way (3×), then Spremi
  const crop = await pickFromGallery(page, sheet);
  const zoom = crop.getByRole("slider", {name: "Zum"});
  await expect(zoom).toBeEnabled();
  // the slider's end, as a finger dragging it all the way right
  await zoom.press("End");
  await expect(zoom).toHaveValue("3");
  await crop.getByRole("button", {name: "Spremi"}).click();
  await expect(crop).toBeHidden();

  // saved in the database: a WebP (the browser's crop), with a new version
  const saved = await db.player.findUniqueOrThrow({where: {id: me.id}, select: {photo_updated_at: true, photo: {select: {type: true, photo: true}}}});
  expect(saved.photo?.type).toBe("image/webp");
  expect(saved.photo!.photo.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(saved.photo!.photo.subarray(8, 12).toString("ascii")).toBe("WEBP");
  expect(saved.photo_updated_at!.getTime()).toBeGreaterThanOrEqual(before);
  const url = `/api/players/${me.id}/photo?v=${saved.photo_updated_at!.getTime()}`;

  // Moj profil: the photo in the avatar at once, "Dodaj sliku" gone
  await expect(hero.getByRole("button", {name: "Promijeni profilnu sliku"})).toBeVisible();
  await expect(hero.getByRole("button", {name: "Dodaj sliku"})).toHaveCount(0);
  const avatar = photoOf(hero, me.id);
  await expect(avatar).toHaveAttribute("src", url);
  await expect.poll(() => loadedWidth(avatar)).toBe(512);
  // what was saved is the zoomed crop: its corner is a blue petal, not the icon's transparent corner
  expect(await brightness(page, url, {x: 0, y: 0, size: 40})).toBeGreaterThan(60);

  // Moje ekipe: the player's chip in the team card carries the photo
  await page.reload();
  const card = page.getByRole("article", {name: me.team.name});
  const chip = myChip(page, me);
  await expect(photoOf(chip, me.id)).toHaveAttribute("src", url);
  await expect.poll(() => loadedWidth(photoOf(chip, me.id))).toBe(512);
  await healthy(page);

  // the team's page, from Stranica ekipe: the player's row has the photo
  await card.getByRole("link", {name: `Stranica ekipe ${me.team.name}`}).click();
  await expect(page.getByRole("heading", {name: me.team.name, level: 1})).toBeVisible();
  const row = page.getByRole("region", {name: "Igrači"}).getByRole("link", {name: new RegExp(`^${me.name} @${me.username}`)});
  await expect(photoOf(row, me.id)).toHaveAttribute("src", url);
  await expect.poll(() => loadedWidth(photoOf(row, me.id))).toBe(512);
  await healthy(page);

  // and the teammate sees it there too ("Ja i suigrači", as seeded)
  const partner = await as("partner");
  await partner.goto(`/teams/${me.team.id}`);
  const partnerRow = myRow(partner, me);
  await expect(photoOf(partnerRow, me.id)).toHaveAttribute("src", url);
  await expect.poll(() => loadedWidth(photoOf(partnerRow, me.id))).toBe(512);
  await healthy(partner);
});

test("Odustani in Pomakni i zumiraj keeps the photo; Makni sliku in the player's own sheet brings the initials back for everyone", async ({
  as,
  db,
  me,
  healthy,
}) => {
  const url = (await me.photoUrl())!;
  const page = await as(me.username);
  await page.goto("/profile");
  const hero = page.getByRole("region", {name: me.username});
  await expect(photoOf(hero, me.id)).toHaveAttribute("src", url);

  // a new file picked, then Odustani: nothing saved
  await hero.getByRole("button", {name: "Promijeni profilnu sliku"}).click();
  const sheet = page.getByRole("dialog", {name: "Profilna slika"});
  const crop = await pickFromGallery(page, sheet);
  await expect(crop.getByRole("button", {name: "Spremi"})).toBeEnabled();
  await crop.getByRole("button", {name: "Odustani"}).click();
  await expect(crop).toBeHidden();
  expect(await me.photoUrl()).toBe(url);
  await expect(photoOf(hero, me.id)).toHaveAttribute("src", url);

  // Makni sliku: no question, the sheet closes, the initials and Dodaj sliku are back
  await hero.getByRole("button", {name: "Promijeni profilnu sliku"}).click();
  await sheet.getByRole("button", {name: "Makni sliku Vraćaju se inicijali"}).click();
  await expect(sheet).toBeHidden();
  await expect(hero.getByRole("button", {name: "Dodaj profilnu sliku"})).toBeVisible();
  await expect(hero.getByRole("button", {name: "Dodaj sliku"})).toBeVisible();
  await expect(photoOf(hero, me.id)).toHaveCount(0);
  expect(await me.photoUrl()).toBeNull();
  expect(await db.playerPhoto.count({where: {player_id: me.id}})).toBe(0);
  await healthy(page);

  // the teammate gets the initials, and the old address is gone
  const mate = await as("partner");
  await mate.goto(`/players/${me.id}`);
  await expect(mate.getByRole("heading", {name: me.name, level: 1})).toBeVisible();
  await expect(mate.getByRole("button", {name: `Prikaži profilnu sliku: ${me.name}`})).toHaveCount(0);
  await expect(photoOf(mate, me.id)).toHaveCount(0);
  expect(await mate.evaluate((u) => fetch(u, {cache: "no-store"}).then((r) => r.status), url)).toBe(404);
});

// BUG: Moje ekipe keeps the player's old avatar (here the initials) until the page is loaded again: Moj profil reads
// the teams once (useMyTeams) and a saved photo updates only the avatar above them (profile/page.tsx). Shared code,
// Bela's C9 marks it too; red at the last line, the chip still shows the initials.
test("a new photo shows in Moje ekipe at once, as on the avatar above it", async ({as, me}) => {
  test.fail();
  await me.removePhoto();
  const page = await as(me.username);
  await page.goto("/profile");
  const hero = page.getByRole("region", {name: me.username});
  const chip = myChip(page, me);
  await expect(chip).toBeVisible();
  await hero.getByRole("button", {name: "Dodaj sliku"}).click();
  const crop = await pickFromGallery(page, page.getByRole("dialog", {name: "Profilna slika"}));
  await crop.getByRole("button", {name: "Spremi"}).click();
  await expect(crop).toBeHidden();
  const url = (await me.photoUrl())!;
  await expect(photoOf(hero, me.id)).toHaveAttribute("src", url);
  // the player looks down at Moje ekipe
  await chip.scrollIntoViewIfNeeded();
  await expect(photoOf(chip, me.id)).toHaveAttribute("src", url);
});
