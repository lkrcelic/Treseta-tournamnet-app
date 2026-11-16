// C6 · the login lock, on the phone, with zakljucan (accounts.locked), which the seed leaves unlocked for this.
// Two limits (src/app/api/login/route.ts): 5 wrong passwords in 5 minutes lock the account on that address (kept in
// the server's memory), so someone else can't lock a player out; and after 20 failed logins in 15 minutes it is locked
// from any address (kept in the database, LoginFailure). While locked even the right password is refused.
// Each test types from a page of its own (as() gives every page its own address, never used again), and the
// `lockFree` fixture clears the account's count in the database before and after, so --repeat-each never meets the
// last run's lock.
import {minutesAgo} from "../../helpers/db";
import {PASSWORD} from "../../helpers/fixtures";
import {expect, LOCKED_NOTE, logIn, note, openLogin, test, whoIsLoggedIn, WRONG_NOTE, WRONG_PASSWORD} from "../../helpers/c6";

test("five wrong passwords lock the account on that phone: the right password is refused there, while another phone logs in", async ({
  as,
  db,
  lockFree,
  healthy,
}) => {
  const {id, username, key} = lockFree;
  const sessions = () => db.luciaSession.count({where: {userId: id}});
  const phone = await as("guest");
  await openLogin(phone);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const answer = await logIn(phone, username, WRONG_PASSWORD);
    expect(answer.status(), `wrong password ${attempt}`).toBe(404);
    await expect(note(phone, WRONG_NOTE)).toBeVisible();
  }
  // every failure counts for the account in the database as well, but 5 is far from that lock
  expect(await db.loginFailure.findUnique({where: {key}})).toMatchObject({count: 5});

  const before = await sessions();
  const locked = await logIn(phone, username, PASSWORD);
  expect(locked.status()).toBe(429);
  await expect(note(phone, LOCKED_NOTE)).toBeVisible();
  await expect(note(phone, WRONG_NOTE)).toHaveCount(0);
  await expect(phone).toHaveURL(/\/login$/);
  expect(await whoIsLoggedIn(phone)).toBeNull();
  expect(await sessions()).toBe(before);
  await healthy(phone);

  // the player's own phone isn't locked by someone else's tries, and its login clears the database count
  const own = await as("guest");
  await openLogin(own);
  expect((await logIn(own, username, PASSWORD)).status()).toBe(200);
  await expect(own.getByRole("button", {name: "Moj profil"})).toBeVisible();
  expect(await whoIsLoggedIn(own)).toBe(username);
  expect(await db.loginFailure.findUnique({where: {key}})).toBeNull();

  // the first phone stays locked for the rest of its five minutes
  expect((await logIn(phone, username, PASSWORD)).status()).toBe(429);
  await expect(note(phone, LOCKED_NOTE)).toBeVisible();
  expect(await whoIsLoggedIn(phone)).toBeNull();
});

test("after 20 failed logins in 15 minutes the account is locked from any phone, until the 15 minutes are over; 19 don't lock it", async ({
  as,
  db,
  lockFree,
  healthy,
}) => {
  const {username, key} = lockFree;
  // nineteen failures in the last minute, from addresses these phones have nothing to do with: the right password still
  // logs in, and the count is gone
  await db.loginFailure.create({data: {key, count: 19, first_failure: minutesAgo(1)}});
  const first = await as("guest");
  await openLogin(first);
  expect((await logIn(first, username, PASSWORD)).status()).toBe(200);
  await expect(first.getByRole("button", {name: "Moj profil"})).toBeVisible();
  expect(await db.loginFailure.findUnique({where: {key}})).toBeNull();

  // twenty: the next try is refused, the right password too
  await db.loginFailure.create({data: {key, count: 20, first_failure: minutesAgo(1)}});
  const phone = await as("guest");
  await openLogin(phone);
  const locked = await logIn(phone, username, PASSWORD);
  expect(locked.status()).toBe(429);
  await expect(note(phone, LOCKED_NOTE)).toBeVisible();
  expect(await whoIsLoggedIn(phone)).toBeNull();
  expect(await db.loginFailure.findUnique({where: {key}})).toMatchObject({count: 21});

  // the window runs from the first failure: 16 minutes later the same password logs in, and the count is gone
  await db.loginFailure.update({where: {key}, data: {first_failure: minutesAgo(16)}});
  expect((await logIn(phone, username, PASSWORD)).status()).toBe(200);
  await expect(phone.getByRole("button", {name: "Moj profil"})).toBeVisible();
  expect(await whoIsLoggedIn(phone)).toBe(username);
  expect(await db.loginFailure.findUnique({where: {key}})).toBeNull();
  await healthy(phone);
});
