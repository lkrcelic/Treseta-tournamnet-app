import assert from "node:assert/strict";
import {test} from "node:test";
import {movementShown, rankMovement, TeamTotals} from "../movement";
import {movementNote, movementView, NO_MOVEMENT, readLeagueStandings, toStandingsRows} from "../ui/standings";

// Ukupni poredak's +/−: places gained or lost since the league's previous night (design is.league).

test("+/− is shown from the league's second night until the league is over", () => {
  // the first night has nothing to compare with
  assert.deepEqual(movementShown([], null, null, "2026-10-14"), {show: false, since: null});
  assert.deepEqual(movementShown(["2026-10-07"], null, "2026-12-16", "2026-10-07"), {show: false, since: null});
  // the second night (being played, or over) compares with the first; later nights with the one before the last
  assert.deepEqual(movementShown(["2026-10-07", "2026-10-14"], null, "2026-12-16", "2026-10-14"), {show: true, since: "2026-10-07"});
  assert.deepEqual(movementShown(["2026-10-07", "2026-10-14", "2026-10-21"], "2026-12-16", null, "2026-10-23"), {show: true, since: "2026-10-14"});
  // the end date itself still counts as running; the day after it the league is over
  assert.deepEqual(movementShown(["2026-12-09", "2026-12-16"], "2026-12-16", null, "2026-12-16"), {show: true, since: "2026-12-09"});
  assert.deepEqual(movementShown(["2026-12-09", "2026-12-16"], "2026-12-16", null, "2026-12-17"), {show: false, since: null});
  // a league without an end date is over once its last night has passed (leagueEnded)
  assert.deepEqual(movementShown(["2026-04-08", "2026-04-15"], null, "2026-04-15", "2026-10-14"), {show: false, since: null});
  assert.deepEqual(movementShown(["2026-04-08", "2026-04-15"], null, null, "2026-10-14"), {show: true, since: "2026-04-08"});
});

const team = (team_id: number, name: string, score: number, point_difference = 0, rounds_played = 3): TeamTotals => ({
  team_id,
  name,
  score,
  point_difference,
  rounds_played,
});

test("the change is the place after the previous night minus the place now", () => {
  // now: Istrani 1., Dalmatinci 2., Zagorci 3.; after the previous night: Dalmatinci, Zagorci, Istrani
  const now = [team(3, "Istrani", 12), team(1, "Dalmatinci", 10), team(2, "Zagorci", 8)];
  const before = new Map([
    [1, {score: 6, point_difference: 100, rounds_played: 3}],
    [2, {score: 6, point_difference: 50, rounds_played: 3}],
    [3, {score: 4, point_difference: 0, rounds_played: 3}],
  ]);
  const m = rankMovement(now, before);
  assert.equal(m.get(3), 2); // 3. → 1.: up two
  assert.equal(m.get(1), -1); // 1. → 2.
  assert.equal(m.get(2), -1); // 2. → 3.
});

test("no change is 0; a team that hadn't played by the previous night has none (null)", () => {
  const now = [team(1, "Dalmatinci", 10), team(2, "Zagorci", 8), team(9, "Novi", 2, 10, 1)];
  const before = new Map([
    [1, {score: 6, point_difference: 0, rounds_played: 3}],
    [2, {score: 4, point_difference: 0, rounds_played: 3}],
    // Novi joined after the previous night
  ]);
  const m = rankMovement(now, before);
  assert.equal(m.get(1), 0);
  assert.equal(m.get(2), 0);
  assert.equal(m.get(9), null);
});

test("a team that joined later doesn't move the others: both tables rank the league's teams now", () => {
  // Aaa joined after the previous night; with zeros then it would have sat above a team with a negative difference
  const now = [team(1, "Brodari", 4, 30), team(5, "Aaa", 2, 5, 1), team(2, "Cetinjani", 0, -40)];
  const before = new Map([
    [1, {score: 2, point_difference: 30, rounds_played: 1}],
    [2, {score: 0, point_difference: -40, rounds_played: 1}],
  ]);
  const m = rankMovement(now, before);
  // then: Brodari 1., Aaa 2. (0 / 0, not in the table), Cetinjani 3. — Cetinjani was 3. and is 3.
  assert.equal(m.get(1), 0);
  assert.equal(m.get(2), 0);
  assert.equal(m.get(5), null);
});

test("ties are broken as in Ukupni poredak: points, difference, then the name (č after c)", () => {
  const now = [team(1, "Čakovčani", 6, 10), team(2, "Cres", 6, 10), team(3, "Dugi", 6, 20)];
  const before = new Map([
    [1, {score: 2, point_difference: 0, rounds_played: 1}],
    [2, {score: 2, point_difference: 0, rounds_played: 1}],
    [3, {score: 2, point_difference: 0, rounds_played: 1}],
  ]);
  // then all equal: Cres, Čakovčani, Dugi; now Čakovčani is 1. (as listed), Cres 2., Dugi 3.
  const m = rankMovement(now, before);
  assert.equal(m.get(1), 1);
  assert.equal(m.get(2), -1);
  assert.equal(m.get(3), 0);
});

test("how a row shows its +/− (▲2, ▼1, –) and what its tooltip says", () => {
  assert.deepEqual(movementView(2), {kind: "up", text: "2", label: "Gore 2 od prošle večeri"});
  assert.deepEqual(movementView(-1), {kind: "down", text: "1", label: "Dolje 1 od prošle večeri"});
  assert.deepEqual(movementView(0), {kind: "same", text: "–", label: "Isto mjesto kao prošle večeri"});
  assert.equal(movementView(null).text, "–");
  assert.equal(movementView(null).kind, "none");
  assert.equal(movementNote("2026-02-10"), "+/− pokazuje koliko je mjesta ekipa dobila ili izgubila od prošle večeri lige (10.02.2026).");
});

test("the standings answer: rows with their +/−, shown only with a night to count from", () => {
  const row = {team_id: 4, team: {team_name: "Istrani"}, rounds_played: 6, wins: 4, draws: 0, losses: 2, point_difference: 120, score: 8, movement: -2};
  const {items, movement} = readLeagueStandings({standings: [row], showMovement: true, movementSince: "2026-10-07"});
  assert.deepEqual(movement, {show: true, since: "2026-10-07"});
  assert.equal(toStandingsRows(items)[0].movement, -2);
  assert.deepEqual(readLeagueStandings({standings: [row], showMovement: false, movementSince: null}).movement, NO_MOVEMENT);
  assert.deepEqual(readLeagueStandings({standings: [row], showMovement: true, movementSince: null}).movement, NO_MOVEMENT);
  // a bare list (before the +/−) still reads, without it
  assert.equal(readLeagueStandings([row]).items.length, 1);
  assert.equal(toStandingsRows([{...row, movement: undefined}])[0].movement, null);
});
