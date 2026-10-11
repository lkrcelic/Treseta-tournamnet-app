import assert from "node:assert/strict";
import {test} from "node:test";
import {planSeats} from "@/app/_lib/service/admin/tables";

// Re-pairing a table on the Daily screen: who sits where afterwards

const round = () =>
  new Map<number, [number, number]>([
    [1, [1, 2]],
    [2, [3, 4]],
    [3, [5, 6]],
  ]);
const seated = (m: Map<number, [number, number]>) => Array.from(m.values()).flat().sort((a, b) => a - b);

test("taking a team from another table swaps it with the team it replaces", () => {
  const out = planSeats(round(), 1, [1, 4]);
  assert.deepEqual(out.get(1), [1, 4]);
  assert.deepEqual(out.get(2), [3, 2]);
  assert.deepEqual(out.get(3), [5, 6]);
});

test("both teams from other tables: each of those tables gets one of the old pair", () => {
  const out = planSeats(round(), 1, [3, 5]);
  assert.deepEqual(out.get(1), [3, 5]);
  assert.deepEqual(out.get(2), [1, 4]);
  assert.deepEqual(out.get(3), [2, 6]);
  assert.deepEqual(seated(out), [1, 2, 3, 4, 5, 6]);
});

test("a whole pair from another table: the two tables trade pairs", () => {
  const out = planSeats(round(), 1, [3, 4]);
  assert.deepEqual(out.get(1), [3, 4]);
  assert.deepEqual(out.get(2), [1, 2]);
});

test("swapping sides at the same table changes only that table", () => {
  const out = planSeats(round(), 1, [2, 1]);
  assert.deepEqual(out.get(1), [2, 1]);
  assert.deepEqual(out.get(2), [3, 4]);
});

test("a team that isn't playing in the round just takes the seat", () => {
  const out = planSeats(round(), 2, [3, 9]);
  assert.deepEqual(out.get(2), [3, 9]);
  assert.deepEqual(seated(out), [1, 2, 3, 5, 6, 9]);
});

test("the input map is left as it was", () => {
  const input = round();
  planSeats(input, 1, [3, 5]);
  assert.deepEqual(input.get(1), [1, 2]);
});
