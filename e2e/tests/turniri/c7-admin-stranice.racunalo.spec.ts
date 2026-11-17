// C7 · the organizer and the admin's own pages, on the computer: the menu's Admin part holds Turniri, Ekipe and Igrači
// and nothing of the league's or Sponzori (DECISIONS #86: "an organizer's menu holds Turniri, Ekipe, Igrači and nothing
// of the league's"), and the league's pages opened by their address refuse the organizer, as Sponzori does by sending
// them to Početna. The routes behind them answer 403 (c7-admin-stranice.spec.ts).
import {expect, test} from "../../helpers/c7";

test("the organizer's menu on the computer holds Turniri, Ekipe and Igrači of the admin's items", async ({as, healthy}) => {
  const page = await as("organizer");
  await page.goto("/");
  await page.getByRole("button", {name: "Izbornik"}).click();
  const menu = page.getByRole("navigation", {name: "Glavni izbornik"});
  await expect(menu.getByRole("link", {name: "Turniri"}).last()).toHaveAttribute("href", "/turniri/upravljanje");
  await expect(menu.getByRole("link", {name: "Ekipe", exact: true})).toHaveAttribute("href", "/teams");
  await expect(menu.getByRole("link", {name: "Igrači", exact: true})).toHaveAttribute("href", "/players");
  for (const item of ["Upravljanje ligom", "Nova liga", "Sponzori"]) await expect(menu.getByRole("link", {name: item})).toHaveCount(0);
  await healthy(page);
});

test("Sponzori by its address sends the organizer to Početna", async ({as}) => {
  const page = await as("organizer");
  await page.goto("/sponzori");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", {name: /^Dobrodošao, /, level: 1})).toBeVisible();
});

test("Upravljanje ligom by its address refuses the organizer on the computer", async ({as, world}) => {
  // BUG (Bela #87, not fixed in Bela yet; shared code): on the computer /league/<id>/manage renders the league's
  // management for an organizer (its tabs, Datumi with Dodaj večer and Obriši večer, Podaci with Spremi promjene,
  // Sponzori); only the reads fail with "Nemaš ovlasti za ovu radnju." The phone shows "Ovo se uređuje na računalu.",
  // Sponzori sends them to Početna
  test.fail();
  const page = await as("organizer");
  await page.goto(`/league/${world.leagues.current.id}/manage`);
  await expect(page.getByRole("heading", {level: 1})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Upravljanje ligom", level: 1})).toHaveCount(0);
  await expect(page.getByRole("tablist", {name: "Prikaz"})).toHaveCount(0);
});

test("Nova liga by its address refuses the organizer on the computer", async ({as}) => {
  // BUG (Bela #87, not fixed in Bela yet; shared code): on the computer /league/new renders the whole Nova liga form for
  // an organizer, with Kreiraj ligu (the route answers 403 once it is sent)
  test.fail();
  const page = await as("organizer");
  await page.goto("/league/new");
  await expect(page.getByRole("heading", {level: 1})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Nova liga", level: 1})).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Kreiraj ligu"})).toHaveCount(0);
});
