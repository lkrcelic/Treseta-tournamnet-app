import assert from "node:assert/strict";
import {test} from "node:test";
import {LEAD_BAR_FULL, runningHands} from "../ui/handRows";

test("each hand shows the totals before it, its winner and the lead after it", () => {
  const out = runningHands([
    {left: 92, right: 70},
    {left: 84, right: 118},
    {left: 0, right: 162},
  ]);
  assert.deepEqual(
    out.map((h) => [h.before, h.winner, h.leader, h.lead]),
    [
      [[0, 0], 0, 0, 22],
      [[92, 70], 1, 1, 12],
      [[176, 188], 1, 1, 174],
    ],
  );
});

test("a tied hand has no winner and a level match no leader", () => {
  const [a, b] = runningHands([
    {left: 81, right: 81},
    {left: 0, right: 0},
  ]);
  assert.equal(a.winner, null);
  assert.equal(a.leader, null);
  assert.equal(b.lead, 0);
  assert.equal(b.leadPct, 0);
});

test("the lead bar fills its half at LEAD_BAR_FULL and stops there", () => {
  const [half, full, over] = runningHands([
    {left: LEAD_BAR_FULL / 2, right: 0},
    {left: LEAD_BAR_FULL / 2, right: 0},
    {left: 200, right: 0},
  ]);
  assert.equal(half.leadPct, 50);
  assert.equal(full.leadPct, 100);
  assert.equal(over.leadPct, 100);
});

test("no hands, no rows", () => {
  assert.deepEqual(runningHands([]), []);
});
