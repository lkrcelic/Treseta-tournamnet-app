// The suite's own check: the section's server answers, the fixtures log in, the world is the one the manifest says.
// If this is red, no other spec on this server means anything.
import {expect, test} from "../../helpers/fixtures";

test("a guest gets the login form", async ({as, healthy}) => {
  const page = await as("guest");
  await page.goto("/login");
  await expect(page.getByRole("button", {name: "Prijavi se"})).toBeVisible();
  await healthy(page);
});

test("a player logged in through the API lands on Početna", async ({as, healthy}) => {
  const page = await as("player");
  await page.goto("/");
  await expect(page.getByRole("button", {name: "Moj profil"})).toBeVisible();
  await healthy(page);
});

test("the database holds the world of the manifest", async ({db, world}) => {
  const league = await db.league.findUniqueOrThrow({where: {league_id: world.leagues.current.id}});
  expect(league.league_name).toBe(world.leagues.current.name);
  const player = await db.player.findUniqueOrThrow({where: {id: world.accounts.player.id}});
  expect(player.username).toBe("player");
});
