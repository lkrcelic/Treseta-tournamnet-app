// C9 · the admin's side of a player's photo, on the admin's phone (the Player page's "Profilna slika" card, admin-mobile
// 35): Makni sliku, asked first with "Zabrani i novu sliku" in the question, takes the photo away (the player isn't told,
// the initials come back for everyone); Zabrani novu sliku stops the player from setting a photo until it is switched
// off: the player's sheet then only says so (DECISIONS #85) and the server refuses the upload with "Admin je isključio
// postavljanje slike." (src/app/_lib/players/privacy.ts). The `me` fixture puts the seeded photo back and the block off.
import {readFileSync} from "node:fs";
import type {Page} from "@playwright/test";
import {expect, photoOf, PICKED_PHOTO, test, type Me} from "../../helpers/c9";
import type {Db} from "../../helpers/db";

const BLOCKED_NOTE = "Admin je isključio postavljanje slike na tvom profilu. Ako misliš da je greška, javi se adminu lige.";
// what the player's phone would send: a picked file as a data: URL
const UPLOAD = {data: `data:image/png;base64,${readFileSync(PICKED_PHOTO).toString("base64")}`};

// The admin's phone on the player's page, at the Profilna slika card
async function adminCard(page: Page, me: Me) {
  await page.goto(`/players/${me.id}`);
  const card = page.getByRole("region", {name: "Profilna slika"});
  await expect(card).toBeVisible();
  return card;
}

// whether the player has a photo in the database, and whether new ones are blocked
async function stored(db: Db, me: Me) {
  const p = await db.player.findUniqueOrThrow({where: {id: me.id}, select: {photo_blocked: true, photo_updated_at: true, photo: {select: {player_id: true}}}});
  return {photo: p.photo != null && p.photo_updated_at != null, blocked: p.photo_blocked};
}

test("Makni sliku: asked first, then the photo is gone for everyone, and the player may still add a new one", async ({as, api, db, me, healthy}) => {
  const admin = await as("admin");
  const card = await adminCard(admin, me);
  await expect(card).toContainText("Ima sliku");
  await expect(card).toContainText("Igrač je odabrao: ja i suigrači. Admin vidi uvijek.");
  await expect(card.getByRole("button", {name: `Prikaži profilnu sliku: ${me.name}`})).toBeVisible();

  // the question, and Odustani changes nothing
  await card.getByRole("button", {name: "Makni sliku"}).click();
  const ask = admin.getByRole("dialog", {name: "Maknuti sliku?"});
  await expect(ask).toContainText(`Slika igrača ${me.name} se briše i umjesto nje se prikazuju inicijali. Igrač ne dobiva obavijest.`);
  await expect(ask.getByRole("switch", {name: /^Zabrani i novu sliku/})).not.toBeChecked();
  await ask.getByRole("button", {name: "Odustani"}).click();
  await expect(ask).toBeHidden();
  expect(await stored(db, me)).toEqual({photo: true, blocked: false});

  // Makni sliku
  await card.getByRole("button", {name: "Makni sliku"}).click();
  await ask.getByRole("button", {name: "Makni sliku"}).click();
  await expect(ask).toBeHidden();
  await expect(card).toContainText("Bez slike");
  await expect(card).not.toContainText("nova je zabranjena");
  await expect(card.getByRole("button", {name: "Makni sliku"})).toHaveCount(0);
  await expect(card.getByRole("switch", {name: /^Zabrani novu sliku/})).not.toBeChecked();
  expect(await stored(db, me)).toEqual({photo: false, blocked: false});
  await healthy(admin);

  // the teammate who saw it ("Ja i suigrači") gets the initials
  const mate = await as("partner");
  await mate.goto(`/players/${me.id}`);
  await expect(mate.getByRole("heading", {name: me.name, level: 1})).toBeVisible();
  await expect(mate.getByRole("button", {name: `Prikaži profilnu sliku: ${me.name}`})).toHaveCount(0);
  await expect(photoOf(mate, me.id)).toHaveCount(0);

  // the player: the initials and Dodaj sliku, and the sheet offers the gallery (no word about the admin)
  const page = await as(me.username);
  await page.goto("/profile");
  const hero = page.getByRole("region", {name: me.username});
  await expect(hero.getByRole("button", {name: "Dodaj profilnu sliku"})).toBeVisible();
  await expect(photoOf(hero, me.id)).toHaveCount(0);
  await hero.getByRole("button", {name: "Dodaj sliku"}).click();
  const sheet = page.getByRole("dialog", {name: "Profilna slika"});
  await expect(sheet.getByRole("button", {name: /^Odaberi iz galerije/})).toBeVisible();
  await expect(sheet.getByText(BLOCKED_NOTE)).toHaveCount(0);
  await healthy(page);
  // and the server takes a new one
  const accepted = await (await api(me.username)).put(`/api/players/${me.id}/photo`, {data: UPLOAD});
  expect(accepted.status()).toBe(200);
  expect(await stored(db, me)).toEqual({photo: true, blocked: false});
});

test("Zabrani novu sliku: the photo stays, but the player can't put up another until the admin switches it off", async ({as, api, db, me, healthy}) => {
  const url = (await me.photoUrl())!;
  const admin = await as("admin");
  const card = await adminCard(admin, me);
  const block = card.getByRole("switch", {name: /^Zabrani novu sliku/});
  await expect(block).toContainText("Igrač ne može postaviti sliku dok ovo ne isključiš.");
  await expect(block).not.toBeChecked();
  await block.click();
  await expect(block).toBeChecked();
  await expect.poll(() => stored(db, me)).toEqual({photo: true, blocked: true});
  await expect(card).toContainText("Ima sliku");
  await healthy(admin);

  // the player: the photo is still there, but tapping it only says why nothing can be changed
  const page = await as(me.username);
  await page.goto("/profile");
  const hero = page.getByRole("region", {name: me.username});
  await expect(photoOf(hero, me.id)).toHaveAttribute("src", url);
  await hero.getByRole("button", {name: "Promijeni profilnu sliku"}).click();
  const sheet = page.getByRole("dialog", {name: "Profilna slika"});
  await expect(sheet.getByRole("note")).toHaveText(BLOCKED_NOTE);
  await expect(sheet.getByRole("button", {name: /^Odaberi iz galerije/})).toHaveCount(0);
  await expect(sheet.getByRole("button", {name: "Fotografiraj"})).toHaveCount(0);
  await expect(sheet.getByRole("radiogroup", {name: "Tko vidi sliku"})).toHaveCount(0);
  await sheet.getByRole("button", {name: "U redu"}).click();
  await expect(sheet).toBeHidden();
  await healthy(page);

  // nor through the server
  const phone = await api(me.username);
  const refused = await phone.put(`/api/players/${me.id}/photo`, {data: UPLOAD});
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error).toBe("Admin je isključio postavljanje slike.");
  expect(await me.photoUrl()).toBe(url);

  // switched off: the gallery is back, and an upload goes through
  await block.click();
  await expect(block).not.toBeChecked();
  await expect.poll(() => stored(db, me)).toEqual({photo: true, blocked: false});
  await page.reload();
  await hero.getByRole("button", {name: "Promijeni profilnu sliku"}).click();
  await expect(sheet.getByRole("button", {name: /^Odaberi iz galerije/})).toBeVisible();
  await expect(sheet.getByRole("note")).toHaveCount(0);
  const accepted = await phone.put(`/api/players/${me.id}/photo`, {data: UPLOAD});
  expect(accepted.status()).toBe(200);
  expect((await accepted.json()).photo_url).toBe(await me.photoUrl());
});

test("Makni sliku with Zabrani i novu sliku: the photo is gone and the player has no way to add one", async ({as, api, db, me, healthy}) => {
  const admin = await as("admin");
  const card = await adminCard(admin, me);
  await card.getByRole("button", {name: "Makni sliku"}).click();
  const ask = admin.getByRole("dialog", {name: "Maknuti sliku?"});
  const alsoBlock = ask.getByRole("switch", {name: /^Zabrani i novu sliku/});
  await expect(alsoBlock).toContainText("Može se isključiti kasnije");
  await alsoBlock.click();
  await expect(alsoBlock).toBeChecked();
  await ask.getByRole("button", {name: "Makni sliku"}).click();
  await expect(ask).toBeHidden();
  await expect(card).toContainText("Bez slike · nova je zabranjena");
  await expect(card.getByRole("switch", {name: /^Zabrani novu sliku/})).toBeChecked();
  await expect.poll(() => stored(db, me)).toEqual({photo: false, blocked: true});
  await healthy(admin);

  // the player: the initials, no Dodaj sliku, and the avatar only says why
  const page = await as(me.username);
  await page.goto("/profile");
  const hero = page.getByRole("region", {name: me.username});
  await expect(hero.getByRole("heading", {name: me.username, level: 1})).toBeVisible();
  await expect(photoOf(hero, me.id)).toHaveCount(0);
  await expect(hero.getByRole("button", {name: "Dodaj sliku"})).toHaveCount(0);
  await hero.getByRole("button", {name: "Dodaj profilnu sliku"}).click();
  const sheet = page.getByRole("dialog", {name: "Profilna slika"});
  await expect(sheet.getByRole("note")).toHaveText(BLOCKED_NOTE);
  await expect(sheet.getByRole("button", {name: /^Odaberi iz galerije/})).toHaveCount(0);
  await healthy(page);

  const refused = await (await api(me.username)).put(`/api/players/${me.id}/photo`, {data: UPLOAD});
  expect(refused.status()).toBe(403);
  expect(await stored(db, me)).toEqual({photo: false, blocked: true});
});
