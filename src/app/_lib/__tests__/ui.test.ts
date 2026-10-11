import assert from "node:assert/strict";
import {test} from "node:test";
import {displayDate, initials, matchesQuery, plural, signed, weekdayDate} from "../ui/text";
import {splitPodium, statsLine, toStandingsRows} from "../ui/standings";
import {filterTables, liveCount, splitColumns, tableColumns, toTableRows} from "../ui/tables";

test("initials from full names, usernames and empty values", () => {
  assert.equal(initials("Marko Marković"), "MM");
  assert.equal(initials("mmarkovic"), "MM");
  assert.equal(initials("ivan.b"), "IB");
  assert.equal(initials("tomo_k"), "TK");
  assert.equal(initials(""), "?");
  assert.equal(initials(undefined), "?");
});

test("signed point difference", () => {
  assert.equal(signed(612), "+612");
  assert.equal(signed(-36), "-36");
  assert.equal(signed(0), "0");
});

test("dates are shown as dd.mm.yyyy with the Croatian weekday", () => {
  assert.equal(displayDate("2026-02-17"), "17.02.2026");
  assert.equal(displayDate("2026-02-17T00:00:00.000Z"), "17.02.2026");
  assert.equal(weekdayDate("2026-02-17"), "Utorak · 17.02.2026");
});

test("search ignores case and Croatian diacritics", () => {
  assert.ok(matchesQuery("Ličani", "lic"));
  assert.ok(matchesQuery("Međimurci", "medi"));
  assert.ok(matchesQuery("Šibenčani", "SIBEN"));
  assert.ok(matchesQuery("anything", "  "));
  assert.ok(!matchesQuery("Zagorci", "dal"));
});

const standings = [
  {team_id: 1, team: {team_name: "Dalmatinci"}, rounds_played: 6, wins: 5, draws: 0, losses: 1, point_difference: 612, score: 10, active_round_count: 1},
  {team_id: 2, team: {team_name: "Slavonci"}, rounds_played: 6, wins: 4, draws: 1, losses: 1, point_difference: 388, score: 9, active_round_count: 0},
  {team_id: 3, team: {team_name: "Zagorci"}, rounds_played: 6, wins: 4, draws: 0, losses: 2, point_difference: -5, score: 8},
  {team_id: 4, team: {team_name: "Istrani"}, rounds_played: 6, wins: 3, draws: 1, losses: 2, point_difference: 0, score: 7},
];

test("standings rows get rank, sign, live and my-team flags", () => {
  const rows = toStandingsRows(standings, ["Zagorci"]);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].diff, "+612");
  assert.equal(rows[0].live, true);
  assert.equal(rows[1].live, false);
  assert.equal(rows[2].mine, true);
  assert.equal(rows[2].diff, "-5");
  assert.equal(statsLine(rows[0], false), "5 POB · 0 NER · 1 IZG");
  assert.equal(statsLine(rows[0], true), "6 OK · 5 POB · 0 NER · 1 IZG");
});

test("podium takes the top three only when there are at least three teams", () => {
  const rows = toStandingsRows(standings);
  const {podium, rest} = splitPodium(rows);
  assert.deepEqual(podium.map((r) => r.name), ["Dalmatinci", "Slavonci", "Zagorci"]);
  assert.deepEqual(rest.map((r) => r.name), ["Istrani"]);
  assert.equal(splitPodium(rows.slice(0, 2)).podium.length, 0);
  assert.equal(splitPodium(rows.map((r) => ({...r, played: 0}))).podium.length, 0);
  assert.equal(toStandingsRows(null).length, 0);
});

const rounds = [
  {id: 11, table_number: 2, team1_id: 3, team2_id: 4, team1: {team_name: "Slavonci"}, team2: {team_name: "Istrani"}, team1_wins: 1, team2_wins: 0, active: true, open: true,
    ongoingMatches: [{player_pair1_score: 312, player_pair2_score: 480}]},
  {id: 10, table_number: 1, team1_id: 1, team2_id: 2, team1: {team_name: "Dalmatinci"}, team2: {team_name: "Zagorci"}, team1_wins: 2, team2_wins: 0, active: false, open: false},
  {id: 12, table_number: 3, team1_id: 5, team2_id: 6, team1: {team_name: "Ličani"}, team2: {team_name: "Podravci"}, team1_wins: 1, team2_wins: 1, active: false, open: false},
  {id: 13, table_number: 4, team1_id: 7, team2_id: 8, team1: {team_name: "Purgeri"}, team2: {team_name: "Boduli"}, team1_wins: 0, team2_wins: 0, active: false, open: true},
];

test("round tables are sorted by table and carry live match points", () => {
  const rows = toTableRows(rounds, ["Zagorci"]);
  assert.deepEqual(rows.map((r) => r.table), [1, 2, 3, 4]);
  assert.equal(rows[1].pointsA, 312);
  assert.equal(rows[1].pointsB, 480);
  assert.equal(rows[0].pointsA, null);
  assert.equal(rows[0].mine, true);
  assert.equal(liveCount(rows), 1);
});

test("table filters by status, team name and table number", () => {
  const rows = toTableRows(rounds);
  assert.equal(filterTables(rows, "all").length, 4);
  assert.deepEqual(filterTables(rows, "live").map((r) => r.table), [2]);
  // a table that has not started yet is neither live nor done
  assert.deepEqual(filterTables(rows, "done").map((r) => r.table), [1, 3]);
  assert.deepEqual(filterTables(rows, "all", "lic").map((r) => r.table), [3]);
  assert.deepEqual(filterTables(rows, "all", "3").map((r) => r.table), [3]);
  assert.equal(filterTables(rows, "live", "dal").length, 0);
});

test("desktop round view uses 1, 2 or 3 columns by team count", () => {
  assert.equal(tableColumns(8), 1);
  assert.equal(tableColumns(30), 2);
  assert.equal(tableColumns(36), 3);
  // with the height known: one column while everything fits, then as few as fit, at most three
  assert.equal(tableColumns(14, 18), 1);
  assert.equal(tableColumns(18, 18), 1);
  assert.equal(tableColumns(19, 18), 2);
  assert.equal(tableColumns(60, 10), 3);
  assert.deepEqual(splitColumns([1, 2, 3, 4, 5], 2), [[1, 2, 3], [4, 5]]);
  assert.deepEqual(splitColumns([], 3), [[], [], []]);
});

import {validateSignup, validateSignupField} from "../ui/signupValidation";

test("signup validation gives Croatian messages per field", () => {
  const ok = {username: "marko", password: "tajna1", confirm: "tajna1", email: "m@x.hr", first_name: "Marko", last_name: "Marković", birth_date: "1990-01-01"};
  assert.deepEqual(validateSignup(ok), {});
  assert.equal(validateSignupField("confirm", {...ok, confirm: "x"}), "Lozinke se ne podudaraju.");
  assert.equal(validateSignupField("username", {...ok, username: "ab"}), "Najmanje 3 znaka.");
  assert.equal(validateSignupField("email", {...ok, email: "nope"}), "Neispravan email.");
  assert.equal(validateSignupField("password", {...ok, password: "123"}), "Najmanje 5 znakova.");
  assert.equal(Object.keys(validateSignup({...ok, birth_date: ""})).join(), "birth_date");
});

test("Croatian plural forms", () => {
  const stol = (n: number) => `${n} ${plural(n, "stol", "stola", "stolova")}`;
  assert.equal(stol(1), "1 stol");
  assert.equal(stol(3), "3 stola");
  assert.equal(stol(5), "5 stolova");
  assert.equal(stol(11), "11 stolova");
  assert.equal(stol(12), "12 stolova");
  assert.equal(stol(21), "21 stol");
  assert.equal(stol(24), "24 stola");
});

import {combineDateAndTime} from "../dates";

test("a match's date and time of day combine into one timestamp", () => {
  const date = new Date("2026-10-04T00:00:00.000Z");
  const time = new Date("1970-01-01T19:42:05.120Z");
  assert.equal(combineDateAndTime(date, time)?.toISOString(), "2026-10-04T19:42:05.120Z");
  assert.equal(combineDateAndTime(date, null), null);
  assert.equal(combineDateAndTime(null, time)?.toISOString(), time.toISOString());
});
