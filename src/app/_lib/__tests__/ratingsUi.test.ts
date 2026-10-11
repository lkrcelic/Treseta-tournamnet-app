import {test} from "node:test";
import assert from "node:assert/strict";
import {formatChange, nightResult, ratingChart, roundsLabel, shortDate} from "@/app/_lib/ui/ratings";

test("changes read +18, −12, 0, and — before the first night", () => {
  assert.equal(formatChange(18), "+18");
  assert.equal(formatChange(-12), "−12");
  assert.equal(formatChange(0), "0");
  assert.equal(formatChange(null), "—");
});

test("rounds use kolo / kola", () => {
  assert.deepEqual([0, 1, 2, 5, 11, 21, 22].map(roundsLabel), ["0 kola", "1 kolo", "2 kola", "5 kola", "11 kola", "21 kolo", "22 kola"]);
});

test("dates and night results", () => {
  assert.equal(shortDate("2026-02-07"), "07.02.");
  assert.deepEqual(nightResult(5, 1), {label: "5:1", tone: "up"});
  assert.deepEqual(nightResult(1, 1), {label: "1:1", tone: "flat"});
  assert.deepEqual(nightResult(0, 2), {label: "0:2", tone: "down"});
});

test("the chart starts at 1500 on the left and ends at the current rating on the right", () => {
  const c = ratingChart([1540, 1520, 1600], 300, 100);
  assert.ok(c.line.startsWith("M0 "));
  assert.equal(c.end.x, 300);
  // higher ratings are higher up (smaller y); 1500 is the lowest value here
  assert.ok(c.end.y < c.baseY);
  assert.ok(c.area.endsWith("L300 100 Z"));
});
