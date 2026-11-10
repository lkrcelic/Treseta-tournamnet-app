import assert from "node:assert/strict";
import {test} from "node:test";
import {roundBackBy, tableHref} from "@/app/_lib/ui/tableScope";

const table = tableHref({kind: "league", id: 2}, 42);

test("the scorepad opened from the round goes Back to it", () => {
  assert.equal(roundBackBy("/league/2/daily-standings", table, 3), "back");
  assert.equal(roundBackBy("/", table, 5), "back");
});

test("a reload at the table goes to the round's address, not into the old steps behind it", () => {
  assert.equal(roundBackBy(table, table, 6), "address");
});

test("a tab without history goes to the round's address", () => {
  assert.equal(roundBackBy(null, table, 1), "address");
  assert.equal(roundBackBy("/league/2/daily-standings", table, 1), "address");
});

test("a document loaded at another table still goes Back", () => {
  assert.equal(roundBackBy(tableHref({kind: "league", id: 2}, 41), table, 4), "back");
});
