// C6 · Registracija and a new account's first steps, on the phone: the form's checks in Croatian (before sending,
// and the server's for a taken username or email), a new account with long Croatian names that logs in to Početna
// with nothing left to ask, and the onboarding of a player from before those questions (novi.igrac,
// accounts.onboarding): Datum rođenja, then Pušiš li? (Bela's DECISIONS #32, #38).
// The accounts made here have a username of their own run and are deleted afterwards (`signups`); novi.igrac is put
// back without a birth date or an answer before and after each test (`newcomer`).
import type {Page} from "@playwright/test";
import {PASSWORD} from "../../helpers/fixtures";
import {capitalised, expect, logIn, openLogin, test, uniqueUsername, whoIsLoggedIn} from "../../helpers/c6";

const field = (page: Page, label: string) => page.getByLabel(label, {exact: true});
const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

async function openSignupForm(page: Page) {
  await page.goto("/signup");
  await expect(page.getByRole("heading", {name: "Registracija"})).toBeVisible();
  // on the phone the form waits behind Registriraj se emailom (Bela's DECISIONS #76)
  await page.getByRole("button", {name: "Registriraj se emailom"}).click();
  await expect(field(page, "Korisničko ime")).toBeFocused();
}

async function fillSignup(page: Page, v: {username: string; password: string; confirm: string; email: string; first: string; last: string; birth: string}) {
  await field(page, "Korisničko ime").fill(v.username);
  await field(page, "Lozinka").fill(v.password);
  await field(page, "Potvrdi lozinku").fill(v.confirm);
  await field(page, "Email").fill(v.email);
  await field(page, "Ime").fill(v.first);
  await field(page, "Prezime").fill(v.last);
  await field(page, "Datum rođenja").fill(v.birth);
}

test("Registracija checks every field in Croatian before sending, and the server refuses a username and an email already taken", async ({
  as,
  db,
  world,
  healthy,
}) => {
  const page = await as("guest");
  const sent: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/signup") sent.push(r.method());
  });
  await openSignupForm(page);
  const submit = page.getByRole("button", {name: "Registriraj se", exact: true});

  // nothing filled in: every field says so under itself
  await submit.click();
  for (const label of ["Korisničko ime", "Lozinka", "Potvrdi lozinku", "Email", "Ime", "Prezime", "Datum rođenja"]) {
    await expect(field(page, label), label).toHaveAccessibleDescription("Obavezno polje.");
  }

  // each field wrong in its own way
  const nextYear = new Date().getFullYear() + 1;
  await fillSignup(page, {username: "Marko Marković", password: "1234", confirm: "12345", email: "marko@gmail", first: "Jo", last: "Li", birth: `${nextYear}-03-01`});
  await submit.click();
  for (const [label, message] of [
    ["Korisničko ime", "Samo slova a–z, brojevi, točka i podvlaka."],
    ["Lozinka", "Najmanje 5 znakova."],
    ["Potvrdi lozinku", "Lozinke se ne podudaraju."],
    ["Email", "Neispravan email."],
    ["Ime", "Najmanje 3 znaka."],
    ["Prezime", "Najmanje 3 znaka."],
    ["Datum rođenja", "Neispravan datum rođenja."],
  ]) {
    await expect(field(page, label), label).toHaveAccessibleDescription(message);
  }
  // the form held all of that back
  expect(sent).toEqual([]);

  // all well formed, but player's username and email in other capitals: the server refuses both, each under its field
  const taken = await db.player.findUniqueOrThrow({where: {id: world.accounts.player.id}});
  const holders = () =>
    Promise.all([
      db.player.count({where: {username: {equals: taken.username, mode: "insensitive"}}}),
      db.player.count({where: {email: {equals: taken.email, mode: "insensitive"}}}),
    ]);
  await fillSignup(page, {
    username: capitalised(taken.username),
    password: PASSWORD,
    confirm: PASSWORD,
    email: capitalised(taken.email),
    first: "Marko",
    last: "Marković",
    birth: "1990-05-17",
  });
  const answer = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/signup");
  await submit.click();
  expect((await answer).status()).toBe(400);
  await expect(field(page, "Korisničko ime")).toHaveAccessibleDescription("To korisničko ime je zauzeto.");
  await expect(field(page, "Email")).toHaveAccessibleDescription("Taj email se već koristi.");
  for (const label of ["Lozinka", "Potvrdi lozinku", "Ime", "Prezime", "Datum rođenja"]) {
    await expect(field(page, label), label).not.toHaveAttribute("aria-invalid", "true");
  }
  // still only player has them
  expect(await holders()).toEqual([1, 1]);
  await healthy(page);
});

test("a new account with long Croatian names: Registracija, then Prijava, Početna with nothing to ask, and the whole name on Moj profil", async ({
  as,
  db,
  signups,
  healthy,
}) => {
  const username = uniqueUsername();
  signups.add(username);
  const first = "Đurđica Ljiljana-Katarina";
  const last = "Šćepanović-Žgaljić Čučković Đaković";
  const email = `${username}@e2e.test`;

  const page = await as("guest");
  await openSignupForm(page);
  // typed in capitals, as a phone keyboard might: saved lowercase (Bela's CHANGELOG 04.11.)
  await fillSignup(page, {username: username.toUpperCase(), password: PASSWORD, confirm: PASSWORD, email, first, last, birth: "1987-02-28"});
  await page.getByRole("radiogroup", {name: "Pušiš li?"}).getByRole("radio", {name: "Da"}).click();
  const answer = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/signup");
  await page.getByRole("button", {name: "Registriraj se", exact: true}).click();
  expect((await answer).status()).toBe(200);
  await expect(page.getByRole("status").filter({hasText: "Profil je napravljen! Preusmjeravamo te na prijavu…"})).toBeVisible();

  const player = await db.player.findUniqueOrThrow({where: {username}});
  expect({...player, birth_date: day(player.birth_date)}).toMatchObject({
    email,
    first_name: first,
    last_name: last,
    birth_date: "1987-02-28",
    smoker: true,
    smoker_answered: true,
    player_role: "PLAYER",
    active: true,
  });

  // Registracija hands over to Prijava, where the new account logs in
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", {name: "Prijava", exact: true})).toBeVisible();
  expect((await logIn(page, username, PASSWORD)).status()).toBe(200);
  await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
  expect(await whoIsLoggedIn(page)).toBe(username);
  // the birth date and Pušiš li? were answered in the form, so Početna asks nothing
  await expect(page.getByRole("dialog", {name: "Datum rođenja"})).toBeHidden();
  await expect(page.getByRole("dialog", {name: "Pušiš li?"})).toBeHidden();
  await healthy(page);

  await page.getByRole("button", {name: "Moj profil"}).click();
  await expect(page.getByText(`${first} ${last}`, {exact: true})).toBeVisible();
  await healthy(page);
});

test("novi.igrac logs in to Datum rođenja and then Pušiš li?; both answers are saved and not asked again", async ({as, db, newcomer, healthy}) => {
  const page = await as("guest");
  await openLogin(page);
  expect((await logIn(page, newcomer.username, PASSWORD)).status()).toBe(200);

  const birth = page.getByRole("dialog", {name: "Datum rođenja"});
  await expect(birth).toBeVisible();
  await birth.getByLabel("Datum rođenja", {exact: true}).fill("1979-11-03");
  await birth.getByRole("button", {name: "Spremi"}).click();
  await expect(birth).toBeHidden();

  // Pušiš li? comes right after the birth date
  const smoker = page.getByRole("dialog", {name: "Pušiš li?"});
  await expect(smoker).toBeVisible();
  await smoker.getByRole("button", {name: "Da", exact: true}).click();
  await expect(smoker).toBeHidden();

  await expect.poll(async () => {
    const p = await db.player.findUniqueOrThrow({where: {id: newcomer.id}});
    return {birth: day(p.birth_date), smoker: p.smoker, answered: p.smoker_answered};
  }).toEqual({birth: "1979-11-03", smoker: true, answered: true});

  // opened again, Početna asks nothing
  await page.reload();
  await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
  await expect(birth).toBeHidden();
  await expect(smoker).toBeHidden();
  await healthy(page);
});

test("Kasnije puts Datum rođenja off until the app opens again; Preskoči answers Pušiš li? with Ne, for good (Bela's DECISIONS #38)", async ({
  as,
  db,
  newcomer,
  healthy,
}) => {
  const page = await as(newcomer.username);
  await page.goto("/");
  const birth = page.getByRole("dialog", {name: "Datum rođenja"});
  const smoker = page.getByRole("dialog", {name: "Pušiš li?"});

  await birth.getByRole("button", {name: "Kasnije"}).click();
  await expect(birth).toBeHidden();
  // Pušiš li? waits for the birth date
  await expect(smoker).toBeHidden();
  expect(await db.player.findUniqueOrThrow({where: {id: newcomer.id}})).toMatchObject({birth_date: null, smoker_answered: false});
  // nor on the other pages of this visit: Moj profil and back to Početna
  await page.getByRole("button", {name: "Moj profil"}).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("button", {name: "Odjava"})).toBeVisible();
  await expect(birth).toBeHidden();
  await page.getByRole("button", {name: "Početni zaslon"}).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
  await expect(birth).toBeHidden();

  // the next time the app opens it asks again
  await page.reload();
  await expect(birth).toBeVisible();
  await birth.getByLabel("Datum rođenja", {exact: true}).fill("2001-06-30");
  await birth.getByRole("button", {name: "Spremi"}).click();
  await expect(birth).toBeHidden();
  await smoker.getByRole("button", {name: "Preskoči"}).click();
  await expect(smoker).toBeHidden();

  await expect.poll(async () => {
    const p = await db.player.findUniqueOrThrow({where: {id: newcomer.id}});
    return {birth: day(p.birth_date), smoker: p.smoker, answered: p.smoker_answered};
  }).toEqual({birth: "2001-06-30", smoker: false, answered: true});

  await page.reload();
  await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
  await expect(birth).toBeHidden();
  await expect(smoker).toBeHidden();
  await healthy(page);
});
