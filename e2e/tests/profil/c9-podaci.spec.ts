// C9 · Moj profil's other parts on the phone: the Podaci rows a player edits in place (Mobitel, Datum rođenja, Pušač),
// with what the field refuses and what the server refuses, Moje ekipe, and Odjava.
// Expected values: Mobitel is typed the Croatian way and saved with the country code ("091 234 5678" → "+385 91 234
// 5678"), an empty field removes it (DECISIONS #52); a birth date is a real day from 1900 up to today (CHANGELOG
// 04.11.: "Neispravan datum rođenja."); Pušač is saved when flipped and counts as the answer to "Pušiš li?". The `me`
// fixture puts the seeded profile back. A logged-out phone goes to Prijava without ?next= (Gost i poziv isn't copied,
// BELA_SYNC).
import {chipLabel, expect, myRow, statusFor, test} from "../../helpers/c9";

// the field's hint for a number that is too short (src/app/_lib/phone.ts; the example doesn't break: no-break spaces)
const PHONE_ERROR = "Upiši cijeli broj, npr. 091 234 5678.";

test("Mobitel: a number too short can't be saved, 091 234 5678 is saved as +385 91 234 5678, and an empty field removes it", async ({
  as,
  api,
  db,
  me,
  healthy,
}) => {
  const page = await as(me.username);
  await page.goto("/profile");
  const podaci = page.getByRole("region", {name: "Podaci"});
  await expect(podaci.getByRole("term").filter({hasText: /^Mobitel$/})).toBeVisible();
  const field = podaci.getByLabel("Mobitel", {exact: true});
  const spremi = podaci.getByRole("button", {name: "Spremi"});

  await podaci.getByRole("button", {name: "Uredi broj mobitela"}).click();
  await expect(field).toBeFocused();
  // letters don't go in, and five digits aren't a number
  await field.pressSequentially("09a1 23b");
  await expect(field).toHaveValue("091 23");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(podaci.getByText(PHONE_ERROR)).toBeVisible();
  await expect(spremi).toBeDisabled();

  // the whole number: the hint comes back, Spremi saves it with the country code
  await field.fill("091 234 5678");
  await expect(field).not.toHaveAttribute("aria-invalid");
  await expect(podaci.getByText("Upisuje se u tvoje oglase u Burzi igrača. Prazno polje briše broj.")).toBeVisible();
  await spremi.click();
  await expect(field).toBeHidden();
  await expect(podaci.getByRole("definition").filter({hasText: /^\+385 91 234 5678$/})).toBeVisible();
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).phone).toBe("+385 91 234 5678");
  await healthy(page);

  // Odustani leaves it as it was
  await podaci.getByRole("button", {name: "Uredi broj mobitela"}).click();
  await expect(field).toHaveValue("+385 91 234 5678");
  await field.fill("098 765 4321");
  await podaci.getByRole("button", {name: "Odustani"}).click();
  await expect(podaci.getByRole("definition").filter({hasText: /^\+385 91 234 5678$/})).toBeVisible();

  // the server refuses a number the field would refuse
  const request = await api(me.username);
  const refused = await request.patch(`/api/players/${me.id}`, {data: {phone: "091 23"}});
  expect(refused.status()).toBe(400);
  expect((await refused.json()).error).toBe(PHONE_ERROR);

  // an empty field removes the number, after a reload too
  await podaci.getByRole("button", {name: "Uredi broj mobitela"}).click();
  await field.fill("");
  await spremi.click();
  await expect(field).toBeHidden();
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).phone).toBeNull();
  await page.reload();
  await expect(podaci.getByRole("button", {name: "Uredi broj mobitela"})).toBeVisible();
  await expect(podaci.getByRole("definition").filter({hasText: /^\+385/})).toHaveCount(0);
});

test("Datum rođenja: a day in the future or before 1900 can't be saved, a real one is saved and shown as dd.mm.yyyy.", async ({as, api, db, me, healthy}) => {
  const seeded = (await db.player.findUniqueOrThrow({where: {id: me.id}})).birth_date!.toISOString().slice(0, 10);
  const shown = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.`;
  const page = await as(me.username);
  await page.goto("/profile");
  const podaci = page.getByRole("region", {name: "Podaci"});
  await expect(podaci.getByRole("definition").filter({hasText: shown(seeded)})).toBeVisible();

  await podaci.getByRole("button", {name: "Uredi datum rođenja"}).click();
  const field = podaci.getByLabel("Datum rođenja", {exact: true});
  const spremi = podaci.getByRole("button", {name: "Spremi"});
  await expect(field).toHaveValue(seeded);
  // unchanged, next year, 1899: nothing to save
  await expect(spremi).toBeDisabled();
  await field.fill(`${new Date().getFullYear() + 1}-01-15`);
  await expect(spremi).toBeDisabled();
  await field.fill("1899-12-31");
  await expect(spremi).toBeDisabled();

  await field.fill("1990-05-17");
  await spremi.click();
  await expect(field).toBeHidden();
  await expect(podaci.getByRole("definition").filter({hasText: /^17\.05\.1990\.$/})).toBeVisible();
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).birth_date?.toISOString().slice(0, 10)).toBe("1990-05-17");
  await page.reload();
  await expect(podaci.getByRole("definition").filter({hasText: /^17\.05\.1990\.$/})).toBeVisible();
  await healthy(page);

  // the server refuses a day that doesn't exist (31. 2.) and one in the future
  const request = await api(me.username);
  for (const birth_date of ["1990-02-31", `${new Date().getFullYear() + 1}-01-15`]) {
    const refused = await request.patch(`/api/players/${me.id}`, {data: {birth_date}});
    expect(refused.status(), birth_date).toBe(400);
    expect((await refused.json()).error).toBe("Neispravan datum rođenja.");
  }
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).birth_date?.toISOString().slice(0, 10)).toBe("1990-05-17");
});

test("Pušač: the switch is saved as soon as it is flipped, as the answer to Pušiš li?, and back", async ({as, db, me, healthy}) => {
  const page = await as(me.username);
  await page.goto("/profile");
  const pusac = page.getByRole("region", {name: "Podaci"}).getByRole("switch", {name: "Pušač"});
  await expect(pusac).not.toBeChecked();
  // the answer is cleared once the page is open (so the Pušiš li? sheet doesn't come): the switch gives it again
  await me.set({smoker_answered: false});

  await pusac.click();
  await expect(pusac).toBeChecked();
  await expect.poll(async () => (await db.player.findUniqueOrThrow({where: {id: me.id}})).smoker).toBe(true);
  expect((await db.player.findUniqueOrThrow({where: {id: me.id}})).smoker_answered).toBe(true);
  await page.reload();
  await expect(pusac).toBeChecked();

  await pusac.click();
  await expect(pusac).not.toBeChecked();
  await expect.poll(async () => (await db.player.findUniqueOrThrow({where: {id: me.id}})).smoker).toBe(false);
  await page.reload();
  await expect(pusac).not.toBeChecked();
  await healthy(page);
});

test("Moje ekipe: the player's teams with their players, each opening the team's page; a player in no team is told so", async ({as, db, me, world, healthy}) => {
  const teams = await db.team.findMany({
    where: {teamPlayers: {some: {player_id: me.id}}},
    include: {teamPlayers: {include: {player: true}}},
    orderBy: {team_id: "asc"},
  });
  expect(teams.map((t) => t.team_id)).toEqual([...world.accounts.player.teams].sort((a, b) => a - b));
  const page = await as(me.username);
  await page.goto("/profile");
  const moje = page.getByRole("region", {name: "Moje ekipe"});
  await expect(moje.getByRole("article")).toHaveCount(teams.length);
  for (const t of teams) {
    const players = moje.getByRole("article", {name: t.team_name}).getByRole("list", {name: "Igrači"}).getByRole("listitem");
    // in name order, each by their @username (after the avatar's initials, when there is no photo)
    const names = [...t.teamPlayers].sort((a, b) => `${a.player.first_name} ${a.player.last_name}`.localeCompare(`${b.player.first_name} ${b.player.last_name}`, "hr"));
    await expect(players).toHaveText(names.map((tp) => chipLabel(tp.player)));
  }
  await healthy(page);

  await moje.getByRole("link", {name: `Stranica ekipe ${me.team.name}`}).click();
  await expect(page).toHaveURL(new RegExp(`/teams/${me.team.id}$`));
  await expect(page.getByRole("heading", {name: me.team.name, level: 1})).toBeVisible();
  await expect(page.getByRole("region", {name: "Igrači"}).getByRole("link", {name: new RegExp(`^${me.name} @${me.username}`)})).toBeVisible();

  const loner = await as("bez.ekipe");
  await loner.goto("/profile");
  const empty = loner.getByRole("region", {name: "Moje ekipe"});
  await expect(empty.getByText("Još nisi član nijedne ekipe.")).toBeVisible();
  await expect(empty.getByRole("article")).toHaveCount(0);
  await healthy(loner);
});

// The username is public (Bela's 5defdb6, DECISIONS #88, on master since the sync of 17 Nov 2026): a teammate sees it too
test("Moje ekipe and the team's page name every player by @username, for a teammate too (DECISIONS #88)", async ({as, db, me}) => {
  const players = await db.player.findMany({where: {teamPlayers: {some: {team_id: me.team.id}}}});
  players.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "hr"));
  const page = await as(me.username);
  await page.goto("/profile");
  const chips = page.getByRole("region", {name: "Moje ekipe"}).getByRole("article", {name: me.team.name}).getByRole("list", {name: "Igrači"}).getByRole("listitem");
  await expect(chips).toHaveText(players.map((p) => new RegExp(`@${p.username.replace(/\./g, "\\.")}$`)));

  const mate = await as("partner");
  await mate.goto(`/teams/${me.team.id}`);
  await expect(myRow(mate, me)).toHaveAccessibleName(new RegExp(`^${me.name} @${me.username}`));
});

test("Odjava: the phone is logged out, the profile asks for Prijava, and the old login no longer works on the server", async ({as, me}) => {
  const page = await as(me.username);
  await page.goto("/profile");
  await expect(page.getByRole("region", {name: me.username})).toBeVisible();
  const login = await page.context().cookies();
  expect(await statusFor(page, "/api/auth/me")).toBe(200);

  await page.getByRole("button", {name: "Odjava"}).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", {name: "Prijavi se"})).toBeVisible();
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);

  // the session behind the old cookie is gone, not only the cookie: put back, it logs nobody in
  await page.context().addCookies(login);
  expect(await statusFor(page, "/api/auth/me")).toBe(401);
});
