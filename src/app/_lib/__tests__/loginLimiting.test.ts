import assert from "node:assert/strict";
import {test} from "node:test";
import {
  clearFailedLogins,
  isLoginLocked,
  MAX_FAILURES,
  recordFailedLogin,
  WINDOW_DURATION,
} from "../rateLimiting/loginLimiting";

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
