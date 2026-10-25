import assert from "node:assert/strict";
import {test} from "node:test";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {LEAD_BAR_FULL, runningHands} from "../ui/handRows";

test("each hand shows the totals with it counted, its winner and the lead after it", () => {
  const out = runningHands([
    {left: 92, right: 70},
    {left: 84, right: 118},
    {left: 0, right: 162},
  ]);
  assert.deepEqual(
    out.map((h) => [h.total, h.winner, h.leader, h.lead]),
    [
      [[92, 70], 0, 0, 22],
      [[176, 188], 1, 1, 12],
      [[176, 350], 1, 1, 174],
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

test("the lead bar fills its half at a lead of MATCH_THRESHOLD and stops there", () => {
  assert.equal(LEAD_BAR_FULL, MATCH_THRESHOLD);
  const [some, full, over] = runningHands([
    {left: 12, right: 0},
    {left: 29, right: 0},
    {left: 5, right: 0},
  ]);
  // a lead of 12 is under a third of the bar, not a full one
  assert.ok(some.leadPct > 29 && some.leadPct < 30);
  assert.equal(full.leadPct, 100);
  assert.equal(over.leadPct, 100);
});

test("no hands, no rows", () => {
  assert.deepEqual(runningHands([]), []);
});
