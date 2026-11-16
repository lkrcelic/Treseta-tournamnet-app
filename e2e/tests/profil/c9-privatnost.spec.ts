// C9 · who sees the profile photo ("Tko vidi sliku", picked in Moj profil's Profilna slika sheet and saved at once):
// Svi = every logged-in player, Ja i suigrači = players who share a team with the player, Samo ja = nobody else. Whoever
// may not see it gets the initials, and the server gives them no address for it: the address itself answers 404
// (src/app/_lib/players/privacy.ts). A guest never gets a photo, whatever was picked (DECISIONS: the public pages have
// "no ratings, photos or usernames"), and the player's page sends a guest to Prijava (Treseta's without ?next=: Gost i
// poziv isn't copied, BELA_SYNC). The player sees their own always.
// Viewers: `partner` (the player's teammate in Igračići), two other players: one from another team (who has teammates,
// just not this player) and `bez.ekipe` (in no team at all), and a guest. Where they look: the player's page, the player's row on the team's page, and what the server sends them about
// the player (LISTS), including Večernji turnir (tournaments.arrival), a public tournament Igračići are signed up for,
// which is all of it a guest can open. Each test starts from another choice than its own (set in the database), so the
// tap is a real change; the `me` fixture puts the seed's "Ja i suigrači" back.
import type {Page} from "@playwright/test";
import type {PhotoVisibility} from "@prisma/client";
import {expect, myRow, photoOf, playerFromAnotherTeam, statusFor, test, type Me} from "../../helpers/c9";

type Choice = {value: PhotoVisibility; label: string; sub: string};
const SVI: Choice = {value: "ALL", label: "Svi", sub: "Svi prijavljeni igrači"};
const SUIGRACI: Choice = {value: "TEAMMATES", label: "Ja i suigrači", sub: "Igrači iz mojih ekipa"};
const SAMO_JA: Choice = {value: "ME", label: "Samo ja", sub: "Ostali vide inicijale"};
const radioName = (c: Choice) => `${c.label} ${c.sub}`;

const CASES: {choice: Choice; from: Choice; partner: boolean; other: boolean}[] = [
  {choice: SVI, from: SAMO_JA, partner: true, other: true},
  {choice: SUIGRACI, from: SVI, partner: true, other: false},
  {choice: SAMO_JA, from: SVI, partner: false, other: false},
];

// Where the app sends a logged-in player a photo's address with the player's data: the player's page, the team's page,
// every team (Moje ekipe), Rejting and the player's rating, the tournament (its card's avatars and its teams), and the
// search for a teammate (Nova ekipa)
const LISTS = (me: Me, tournament: number) => [
  `/api/players/${me.id}/overview`,
  `/api/teams/${me.team.id}`,
  "/api/teams",
  "/api/ratings",
  `/api/ratings/${me.id}`,
  `/api/tournaments/${tournament}`,
  `/api/players/search?q=${encodeURIComponent(me.name.split(" ")[1])}`,
];

// What a logged-in viewer gets of the player's photo: on the player's page (a button that opens it large), in the
// player's row on the team's page, in everything the server sends about the player, and for the address itself; or
// none of it
async function expectSeen(page: Page, me: Me, url: string, tournament: number, sees: boolean) {
  await page.goto(`/players/${me.id}`);
  const hero = page.getByRole("region", {name: me.name});
  await expect(hero.getByRole("heading", {name: me.name, level: 1})).toBeVisible();
  await expect(hero.getByRole("button", {name: `Prikaži profilnu sliku: ${me.name}`})).toHaveCount(sees ? 1 : 0);
  await expect(photoOf(hero, me.id)).toHaveCount(sees ? 1 : 0);
  // nor anywhere else on the page (the player's chip in the Ekipe card)
  if (!sees) await expect(photoOf(page, me.id)).toHaveCount(0);

  await page.goto(`/teams/${me.team.id}`);
  const row = myRow(page, me);
  await expect(row).toBeVisible();
  await expect(photoOf(row, me.id)).toHaveCount(sees ? 1 : 0);
  if (sees) await expect(photoOf(row, me.id)).toHaveAttribute("src", url);

  for (const list of LISTS(me, tournament)) {
    const data = await page.evaluate((u) => fetch(u).then((r) => r.text()), list);
    // the player is in it: by name, by first and last name apart (a team's players, which on master carry the
    // username only for the player and an admin, until Bela's 5defdb6 comes with the sync), or by username
    const named = [me.name, `"first_name":"${me.firstName}","last_name":"${me.lastName}"`, `"username":"${me.username}"`];
    expect(named.some((n) => data.includes(n)), list).toBe(true);
    if (sees) expect(data, list).toContain(url);
    else expect(data, list).not.toContain(`/api/players/${me.id}/photo`);
  }
  expect(await statusFor(page, url)).toBe(sees ? 200 : 404);
}

for (const {choice, from, partner, other} of CASES) {
  test(`Tko vidi sliku · ${choice.label}: the teammate ${partner ? "sees" : "doesn't see"} the photo, other players ${other ? "see" : "don't see"} it, a guest never does`, async ({
    as,
    db,
    me,
    world,
    healthy,
  }) => {
    await me.set({photo_visibility: from.value});
    const url = (await me.photoUrl())!;
    const tournament = world.tournaments.arrival.id;

    // Moj profil → the photo → Profilna slika → Tko vidi sliku
    const page = await as(me.username);
    await page.goto("/profile");
    await page.getByRole("region", {name: me.username}).getByRole("button", {name: "Promijeni profilnu sliku"}).click();
    const group = page.getByRole("dialog", {name: "Profilna slika"}).getByRole("radiogroup", {name: "Tko vidi sliku"});
    await expect(group.getByRole("radio", {name: radioName(from)})).toBeChecked();
    const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && new URL(r.url()).pathname === `/api/players/${me.id}`);
    await group.getByRole("radio", {name: radioName(choice)}).click();
    expect((await saved).ok()).toBe(true);
    await expect(group.getByRole("radio", {name: radioName(choice)})).toBeChecked();
    await expect(group.getByRole("radio", {checked: true})).toHaveCount(1);
    await expect.poll(async () => (await db.player.findUniqueOrThrow({where: {id: me.id}})).photo_visibility).toBe(choice.value);
    await healthy(page);

    // after a reload the player still sees their own photo, and the sheet still has the choice
    await page.reload();
    const hero = page.getByRole("region", {name: me.username});
    await expect(photoOf(hero, me.id)).toHaveAttribute("src", url);
    await hero.getByRole("button", {name: "Promijeni profilnu sliku"}).click();
    await expect(page.getByRole("dialog", {name: "Profilna slika"}).getByRole("radio", {name: radioName(choice)})).toBeChecked();

    // the teammate, a player from another team and a player from no team
    const mate = await as("partner");
    await expectSeen(mate, me, url, tournament, partner);
    await healthy(mate);
    for (const who of [await playerFromAnotherTeam(db, me), "bez.ekipe"]) {
      const stranger = await as(who);
      await expectSeen(stranger, me, url, tournament, other);
      await healthy(stranger);
    }

    // a guest: the player's page asks for Prijava, the photo's address for a login, and the public tournament lists
    // the player in Igračići with no photo in its data
    const guest = await as("guest");
    await guest.goto(`/players/${me.id}`);
    await expect(guest).toHaveURL(/\/login$/);
    await expect(guest.getByRole("button", {name: "Prijavi se"})).toBeVisible();
    expect(await statusFor(guest, url)).toBe(401);
    await guest.goto(`/turniri/${tournament}/ekipe`);
    await expect(guest.getByRole("listitem").filter({hasText: me.team.name})).toContainText(me.name);
    await expect(photoOf(guest, me.id)).toHaveCount(0);
    const data = await guest.evaluate((id) => fetch(`/api/tournaments/${id}`).then((r) => r.text()), tournament);
    expect(data).toContain(me.name);
    expect(data).not.toContain(`/api/players/${me.id}/photo`);
    await healthy(guest);
  });
}
