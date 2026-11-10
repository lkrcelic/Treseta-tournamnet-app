import assert from "node:assert/strict";
import {test} from "node:test";
import {onRoundPages} from "@/app/_lib/ui/lineupPass";

// Tko igra before the admin's scorepad: the pass to the scorepad holds while the admin stays on the round's pages

test("a league night's table and a tournament's table are both the round's scorepad", () => {
  assert.equal(onRoundPages(4777, "/league/3/daily-standings/table/4777"), true);
  assert.equal(onRoundPages(4777, "/turniri/14/stol/4777"), true);
  assert.equal(onRoundPages(4777, "/round/lineup/4777"), true);
});

test("another round's pages or any other page end the pass", () => {
  assert.equal(onRoundPages(4777, "/turniri/14/stol/47770"), false);
  assert.equal(onRoundPages(4777, "/turniri/14/stol/477"), false);
  assert.equal(onRoundPages(4777, "/turniri/14/upravljanje"), false);
  assert.equal(onRoundPages(4777, "/round/lineup/4778"), false);
  assert.equal(onRoundPages(4777, "/"), false);
});
