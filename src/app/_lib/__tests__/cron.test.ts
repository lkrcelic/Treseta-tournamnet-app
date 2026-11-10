import assert from "node:assert/strict";
import {test} from "node:test";
import {cronAuthorized} from "@/app/_lib/cron";

// /api/cron/tick: only the scheduler, with the secret

test("the tick takes CRON_SECRET as a Bearer token", () => {
  assert.equal(cronAuthorized("Bearer 7f3a9c", "7f3a9c"), true);
  assert.equal(cronAuthorized("Bearer 7f3a9d", "7f3a9c"), false);
  assert.equal(cronAuthorized("Bearer 7f3a9c ", "7f3a9c"), false);
  assert.equal(cronAuthorized("7f3a9c", "7f3a9c"), false);
  assert.equal(cronAuthorized(null, "7f3a9c"), false);
});

test("without CRON_SECRET set nobody may call it", () => {
  assert.equal(cronAuthorized("Bearer undefined", undefined), false);
  assert.equal(cronAuthorized("Bearer ", ""), false);
});
