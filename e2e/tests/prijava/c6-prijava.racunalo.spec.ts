// C6 · Prijava and Odjava on the computer: the same form beside Treseta's name, without the phone's install sheet,
// and Odjava in the menu's user card (the phone has it on Moj profil, Bela's DECISIONS #36).
import {PASSWORD} from "../../helpers/fixtures";
import {BRAND_NAME, expect, logIn, openLogin, test, whoIsLoggedIn} from "../../helpers/c6";

test("on the computer, logging in opens Početna with the player in the menu, and the menu's Odjava ends the session", async ({as, world, healthy}) => {
  const {username} = world.accounts.noTeam;
  const page = await as("guest");
  await openLogin(page);
  // the brand half beside the form
  await expect(page.getByText(BRAND_NAME, {exact: true})).toBeVisible();
  // Google is offered above the form; only looked at
  const google = page.getByRole("button", {name: "Prijava s Googleom"});
  await expect(google).toBeEnabled();
  expect((await google.boundingBox())!.y).toBeLessThan((await page.getByLabel("Korisničko ime ili Email").boundingBox())!.y);
  expect((await logIn(page, username, PASSWORD)).status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  expect(await whoIsLoggedIn(page)).toBe(username);

  await page.getByRole("button", {name: "Izbornik"}).click();
  await expect(page.getByText(username, {exact: true})).toBeVisible();
  await healthy(page);
  await page.getByRole("button", {name: "Odjava"}).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", {name: "Prijava", exact: true})).toBeVisible();
  expect(await whoIsLoggedIn(page)).toBeNull();

  // Moj profil needs a login; Treseta's Prijava has no way back to it (Bela's ?next= came with Gost i poziv, not
  // copied: BELA_SYNC.md · Not copied from Bela)
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", {name: "Prijava", exact: true})).toBeVisible();
  await healthy(page);
});
