// C6 · Prijava and Odjava on the phone: logging in with the username or the email in any case (phone keyboards
// capitalize the first letter), a wrong password, a deactivated account (Bela's DECISIONS #40), the Google button
// that is only looked at, and Odjava, after which the old session is refused and a page that needs a login opens
// Prijava. In Treseta Prijava brings the player back only to a Burza form; from any other page it leads to Početna.
// The logins use bez.ekipe (accounts.noTeam): onboarded and in no team, so Početna opens without a sheet or a table.
// Every wrong password is followed by the right one, which clears the account's failed-login counts again.
import {PASSWORD} from "../../helpers/fixtures";
import {
  BRAND_NAME,
  capitalised,
  DEACTIVATED_NOTE,
  expect,
  logIn,
  note,
  openLogin,
  test,
  uniqueUsername,
  whoIsLoggedIn,
  WRONG_API,
  WRONG_NOTE,
  WRONG_PASSWORD,
} from "../../helpers/c6";

// what the player types, made from the account as stored
for (const {how, field, typed} of [
  {how: "the username", field: "username", typed: (stored: string) => stored},
  {how: "the username with capitals and spaces around it", field: "username", typed: (stored: string) => `  ${capitalised(stored)} `},
  {how: "the email in any case", field: "email", typed: (stored: string) => capitalised(stored)},
] as const) {
  test(`logging in with ${how} opens Početna as that player`, async ({as, db, world, healthy}) => {
    const account = await db.player.findUniqueOrThrow({where: {id: world.accounts.noTeam.id}});
    const login = typed(account[field]);
    expect(login.trim().toLowerCase()).toBe(account[field]);
    const page = await as("guest");
    await openLogin(page);
    const answer = await logIn(page, login, PASSWORD);
    expect(answer.status()).toBe(200);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
    expect(await whoIsLoggedIn(page)).toBe(account.username);
    await healthy(page);
  });
}

test("a wrong password or an unknown username is refused with the same words, and the right password then logs in", async ({as, world, loginCounts, healthy}) => {
  const {username} = world.accounts.noTeam;
  const page = await as("guest");
  await openLogin(page);

  const wrong = await logIn(page, username, WRONG_PASSWORD);
  expect(wrong.status()).toBe(404);
  expect(await wrong.json()).toEqual({error: WRONG_API});
  await expect(note(page, WRONG_NOTE)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(await whoIsLoggedIn(page)).toBeNull();

  // a username nobody has reads the same, so Prijava doesn't tell which usernames exist
  // (its failure is counted under the name, and no right password ever clears it)
  const nobody = uniqueUsername();
  loginCounts.forget(`login:${nobody}`);
  const unknown = await logIn(page, nobody, WRONG_PASSWORD);
  expect(unknown.status()).toBe(404);
  expect(await unknown.json()).toEqual({error: WRONG_API});
  await expect(note(page, WRONG_NOTE)).toBeVisible();

  const right = await logIn(page, username, PASSWORD);
  expect(right.status()).toBe(200);
  await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
  expect(await whoIsLoggedIn(page)).toBe(username);
  await healthy(page);
});

test("Prijava carries Treseta's name; Prijava and Registracija offer Google first, above the form (the button is only looked at, never pressed)", async ({
  as,
  healthy,
}) => {
  const page = await as("guest");
  await openLogin(page);
  await expect(page).toHaveTitle(BRAND_NAME);
  await expect(page.getByRole("main").getByText(BRAND_NAME, {exact: true})).toBeVisible();
  const google = page.getByRole("button", {name: "Prijava s Googleom"});
  await expect(google).toBeEnabled();
  const username = page.getByLabel("Korisničko ime ili Email");
  expect((await google.boundingBox())!.y).toBeLessThan((await username.boundingBox())!.y);
  await healthy(page);

  // Registracija on the phone opens with the two ways, Google first (Bela's DECISIONS #76)
  await page.goto("/signup");
  const googleSignup = page.getByRole("button", {name: "Registriraj se s Googleom"});
  await expect(googleSignup).toBeEnabled();
  const withEmail = page.getByRole("button", {name: "Registriraj se emailom"});
  expect((await googleSignup.boundingBox())!.y).toBeLessThan((await withEmail.boundingBox())!.y);
  await healthy(page);
});

test("a deactivated account can't log in: the right password says so, a wrong one doesn't tell (Bela's DECISIONS #40)", async ({as, db, world, healthy}) => {
  const {id, username} = world.accounts.inactive;
  const sessions = () => db.luciaSession.count({where: {userId: id}});
  const before = await sessions();
  const page = await as("guest");
  await openLogin(page);

  const wrong = await logIn(page, username, WRONG_PASSWORD);
  expect(wrong.status()).toBe(404);
  await expect(note(page, WRONG_NOTE)).toBeVisible();

  const right = await logIn(page, username, PASSWORD);
  expect(right.status()).toBe(403);
  await expect(note(page, DEACTIVATED_NOTE)).toBeVisible();
  await expect(note(page, WRONG_NOTE)).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
  expect(await whoIsLoggedIn(page)).toBeNull();
  expect(await sessions()).toBe(before);
  await healthy(page);
});

test("Odjava on Moj profil ends the session: the old cookie is refused, and a page that needs a login opens Prijava, which leads to Početna", async ({
  as,
  api,
  world,
  healthy,
}) => {
  const page = await as("noTeam");
  // the session as this phone holds it, to try it again after Odjava
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const elsewhere = await api("guest");
  expect((await elsewhere.get("/api/auth/me", {headers: {Cookie: cookie}})).status()).toBe(200);

  await page.goto("/profile");
  await page.getByRole("button", {name: "Odjava"}).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", {name: "Prijava", exact: true})).toBeVisible();
  expect(await whoIsLoggedIn(page)).toBeNull();
  // ended on the server too, not only forgotten by this phone
  expect((await elsewhere.get("/api/auth/me", {headers: {Cookie: cookie}})).status()).toBe(401);

  // Moj profil needs a login. Treseta's Prijava has no way back to it (Bela's ?next= for every page came with Gost i
  // poziv, not copied: BELA_SYNC.md · Not copied from Bela), so logging in lands on Početna
  await openLogin(page, "/profile");
  await expect(page).toHaveURL(/\/login$/);
  expect((await logIn(page, world.accounts.noTeam.username, PASSWORD)).status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
  expect(await whoIsLoggedIn(page)).toBe(world.accounts.noTeam.username);
  await healthy(page);
});

test("a Burza form opened without a login: Prijava keeps the way back, and logging in opens the form", async ({as, world, healthy}) => {
  // the one page Treseta's Prijava brings a player back to (middleware.ts, loginUrl)
  const page = await as("guest");
  await openLogin(page, "/burza/novi/dostupan");
  await expect(page).toHaveURL(/\/login\?next=%2Fburza%2Fnovi%2Fdostupan$/);
  expect((await logIn(page, world.accounts.noTeam.username, PASSWORD)).status()).toBe(200);
  await expect(page).toHaveURL(/\/burza\/novi\/dostupan$/);
  await expect(page.getByRole("heading", {name: "Dostupan sam"})).toBeVisible();
  expect(await whoIsLoggedIn(page)).toBe(world.accounts.noTeam.username);
  await healthy(page);
});
