import assert from "node:assert/strict";
import {test} from "node:test";
import {
  clearFailedLogins,
  isLoginLocked,
  MAX_FAILURES,
  recordFailedLogin,
  WINDOW_DURATION,
} from "../rateLimiting/loginLimiting";
import {ACCOUNT_MAX_FAILURES, countAccountLogin} from "../rateLimiting/accountLimiting";
import {verifyPassword} from "../service/auth/verifyPassword";
import argon2 from "argon2";

test("only failed logins lock a username, and only for the window", () => {
  const key = "1.2.3.4|marko";
  const start = 1_000_000;
  for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailedLogin(key, start + i);
  assert.equal(isLoginLocked(key, start + 10), false);

  recordFailedLogin(key, start + 10);
  assert.equal(isLoginLocked(key, start + 11), true);
  assert.equal(isLoginLocked(key, start + WINDOW_DURATION + 1), false);
});

test("a successful login clears the failures", () => {
  const key = "1.2.3.4|ivan";
  for (let i = 0; i < MAX_FAILURES - 1; i++) recordFailedLogin(key, i);
  clearFailedLogins(key);
  recordFailedLogin(key, 100);
  assert.equal(isLoginLocked(key, 101), false);
});

test("logins without failures are never locked", () => {
  assert.equal(isLoginLocked("1.2.3.4|ana"), false);
});

// A stand-in for the database: answers the upsert with the next count, as the INSERT … ON CONFLICT would
function fakeDb() {
  const calls: string[] = [];
  let count = 0;
  const db = {
    $queryRaw: async () => {
      calls.push("upsert");
      return [{count: ++count}];
    },
    $executeRaw: async () => {
      calls.push("delete");
      return 0;
    },
  };
  return {db: db as unknown as Parameters<typeof countAccountLogin>[0], calls};
}

test("an account is locked from any address after ACCOUNT_MAX_FAILURES attempts", async () => {
  const {db} = fakeDb();
  for (let i = 0; i < ACCOUNT_MAX_FAILURES; i++) assert.equal(await countAccountLogin(db, "player:1"), false);
  assert.equal(await countAccountLogin(db, "player:1"), true);
});

test("old rows are dropped when a new window starts, not on every attempt", async () => {
  const {db, calls} = fakeDb();
  await countAccountLogin(db, "login:nobody");
  await countAccountLogin(db, "login:nobody");
  assert.deepEqual(calls, ["upsert", "delete", "upsert"]);
});

test("a missing account or a Google one never logs in, a real hash still does", async () => {
  assert.equal(await verifyPassword(null, "lozinka"), false);
  assert.equal(await verifyPassword(undefined, "lozinka"), false);
  const hash = await argon2.hash("lozinka");
  assert.equal(await verifyPassword(hash, "lozinka"), true);
  assert.equal(await verifyPassword(hash, "kriva"), false);
});
