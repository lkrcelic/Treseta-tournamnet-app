import assert from "node:assert/strict";
import {test} from "node:test";
import {LeagueRow, LeagueTable, needsHeadToHead, rankLeague} from "@/app/_lib/leagueOrder";
import {rankMovement} from "@/app/_lib/movement";

// The league's order (Ukupni and Dnevni poredak): points, difference, the head-to-head of the teams still level, the name

const row = (team_id: number, name: string, score: number, point_difference: number, rounds_played = 3): LeagueRow => ({team_id, name, score, point_difference, rounds_played});
// a table of two partije: wins 2:0, 1:1 or 0:2, and team1's points minus team2's over them
const table = (team1_id: number, team2_id: number, team1_wins: number, team2_wins: number, diff: number): LeagueTable => ({team1_id, team2_id, team1_wins, team2_wins, diff});
const order = (rows: LeagueRow[], tables: LeagueTable[] = []) => rankLeague(rows, (r) => r, tables).map((r) => r.name);

test("points first, then the difference, as before", () => {
  assert.deepEqual(order([row(1, "Asovi", 4, 50), row(2, "Bele", 6, -20), row(3, "Cvike", 4, 80)]), ["Bele", "Cvike", "Asovi"]);
});

test("two teams level on points and difference: the one that won their table is above, whatever the name", () => {
  const rows = [row(1, "Asovi", 6, 120), row(2, "Zvanja", 6, 120), row(3, "Dupli", 2, -240)];
  // Zvanja beat Asovi 2:0
  assert.deepEqual(order(rows, [table(1, 2, 0, 2, -310), table(1, 3, 2, 0, 400)]), ["Zvanja", "Asovi", "Dupli"]);
  // without a table between them the name decides
  assert.deepEqual(order(rows, [table(1, 3, 2, 0, 400)]), ["Asovi", "Zvanja", "Dupli"]);
});

test("a draw between them goes to the difference of their table, then the name", () => {
  const rows = [row(1, "Asovi", 5, 90), row(2, "Zvanja", 5, 90)];
  assert.deepEqual(order(rows, [table(2, 1, 1, 1, -40)]), ["Asovi", "Zvanja"]);
  assert.deepEqual(order(rows, [table(2, 1, 1, 1, 40)]), ["Zvanja", "Asovi"]);
  assert.deepEqual(order(rows, [table(2, 1, 1, 1, 0)]), ["Asovi", "Zvanja"]);
});

test("they met more than once in a season: every table between them counts", () => {
  const rows = [row(1, "Asovi", 8, 300), row(2, "Zvanja", 8, 300)];
  // Asovi won the first 2:0, Zvanja the next two
  assert.deepEqual(order(rows, [table(1, 2, 2, 0, 200), table(1, 2, 0, 2, -150), table(2, 1, 2, 0, 90)]), ["Zvanja", "Asovi"]);
});

test("three teams level: a small table of only their tables against each other", () => {
  const rows = [row(1, "Asovi", 6, 100), row(2, "Bele", 6, 100), row(3, "Cvike", 6, 100), row(4, "Dupli", 10, 300)];
  const tables = [
    table(1, 2, 2, 0, 250), // Asovi beat Bele
    table(2, 3, 2, 0, 180), // Bele beat Cvike
    table(3, 1, 2, 0, 60), // Cvike beat Asovi
    table(4, 1, 2, 0, 500), // Dupli's table with Asovi doesn't count among the three
  ];
  // each 2 points among the three; differences among them: Asovi 250 − 60 = 190, Bele 180 − 250 = −70, Cvike 60 − 180 = −120
  assert.deepEqual(order(rows, tables), ["Dupli", "Asovi", "Bele", "Cvike"]);
});

test("the tables are needed only when two teams that have played are level", () => {
  assert.equal(needsHeadToHead([row(1, "A", 4, 10), row(2, "B", 2, 10)]), false);
  assert.equal(needsHeadToHead([row(1, "A", 4, 10), row(2, "B", 4, 10)]), true);
  // teams that haven't played are all 0 / 0, but there is nothing between them to count
  assert.equal(needsHeadToHead([row(1, "A", 0, 0, 0), row(2, "B", 0, 0, 0), row(3, "C", 2, 30)]), false);
});

test("+/−: the place after the previous night counts the head-to-head of the tables played by then", () => {
  // now Asovi are clearly first; after the previous night Asovi and Zvanja were level, and Zvanja had beaten them
  const now = [row(1, "Asovi", 8, 200), row(2, "Zvanja", 6, 150)];
  const before = new Map([
    [1, {score: 6, point_difference: 150, rounds_played: 3}],
    [2, {score: 6, point_difference: 150, rounds_played: 3}],
  ]);
  const then = [table(1, 2, 0, 2, -100)];
  // then: Zvanja 1., Asovi 2. → Asovi up one, Zvanja down one
  const m = rankMovement(now, before, then);
  assert.equal(m.get(1), 1);
  assert.equal(m.get(2), -1);
  // without that table the name decided then (Asovi first): no change
  const plain = rankMovement(now, before);
  assert.equal(plain.get(1), 0);
  assert.equal(plain.get(2), 0);
});
