import {test} from "node:test";
import assert from "node:assert/strict";
import {defaultLineup, ratedPlayerIds} from "@/app/_lib/lineup";

test("a team starts with the players of its last round in the league", () => {
  assert.deepEqual(defaultLineup([1, 2, 3, 4], [3, 4], [1, 2]), [3, 4]);
});

test("in the league's first round a team starts with its founders", () => {
  assert.deepEqual(defaultLineup([1, 2, 3], null, [3, 1]), [3, 1]);
  assert.deepEqual(defaultLineup([1, 2, 3], [], [2, 3]), [2, 3]);
});

test("players who left the team are replaced from the roster", () => {
  assert.deepEqual(defaultLineup([1, 2, 3], [9, 3], [1, 2]), [3, 1]);
  assert.deepEqual(defaultLineup([5, 6], null, [null, 9]), [5, 6]);
});

test("a team with fewer than two players plays with what it has", () => {
  assert.deepEqual(defaultLineup([7], null, [7, null]), [7]);
  assert.deepEqual(defaultLineup([], [1, 2], [1, 2]), []);
});

test("ratings go to the round's lineup, or the whole roster for a round without one", () => {
  const lineup = [
    {player_id: 1, team_id: 10},
    {player_id: 3, team_id: 10},
    {player_id: 7, team_id: 20},
    {player_id: 8, team_id: 20},
  ];
  assert.deepEqual(ratedPlayerIds(lineup, 10, [1, 2, 3, 4]), [1, 3]);
  assert.deepEqual(ratedPlayerIds(lineup, 20, [7, 8, 9]), [7, 8]);
  assert.deepEqual(ratedPlayerIds([], 10, [1, 2, 3, 4]), [1, 2, 3, 4]);
});
