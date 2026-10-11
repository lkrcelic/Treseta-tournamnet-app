import assert from "node:assert/strict";
import {test} from "node:test";
import {
  CONFERENCE_COLORS,
  conferenceDot,
  conferenceLookup,
  conferencesError,
  distributeEvenly,
  MAX_CONFERENCES,
  nextFreeColor,
  sameConferencePairs,
} from "../conferences";
import {inConference, splitPodium, toStandingsRows} from "../ui/standings";
import {toTableRows} from "../ui/tables";

const BLUE = CONFERENCE_COLORS[0].hex;
const ORANGE = CONFERENCE_COLORS[1].hex;
const TEAL = CONFERENCE_COLORS[2].hex;

test("a league has no conferences or 2–6, named and colored from the palette, none twice", () => {
  assert.equal(conferencesError([]), null);
  assert.equal(conferencesError([{name: "Sjever", color: BLUE}, {name: "Jug", color: ORANGE}]), null);
  // the hex may come in lower case
  assert.equal(conferencesError([{name: "Sjever", color: BLUE.toLowerCase()}, {name: "Jug", color: ORANGE}]), null);
  assert.match(conferencesError([{name: "Sjever", color: BLUE}]) ?? "", /at least 2/);
  const seven = Array.from({length: MAX_CONFERENCES + 1}, (_, i) => ({name: `K${i}`, color: CONFERENCE_COLORS[i % MAX_CONFERENCES].hex}));
  assert.match(conferencesError(seven) ?? "", /at most 6/);
  assert.match(conferencesError([{name: " ", color: BLUE}, {name: "Jug", color: ORANGE}]) ?? "", /needs a name/);
  assert.match(conferencesError([{name: "Sjever", color: BLUE}, {name: " sjever ", color: ORANGE}]) ?? "", /same name/);
  assert.match(conferencesError([{name: "Sjever", color: BLUE}, {name: "Jug", color: BLUE}]) ?? "", /same color/);
  assert.match(conferencesError([{name: "Sjever", color: "#FF0000"}, {name: "Jug", color: ORANGE}]) ?? "", /palette/);
  assert.match(conferencesError([{name: "x".repeat(41), color: BLUE}, {name: "Jug", color: ORANGE}]) ?? "", /at most 40/);
});

test("a new conference row takes the first color nobody has", () => {
  assert.equal(nextFreeColor([]), BLUE);
  assert.equal(nextFreeColor([BLUE.toLowerCase(), TEAL]), ORANGE);
  assert.equal(nextFreeColor(CONFERENCE_COLORS.map((c) => c.hex)), BLUE);
});

const data = {
  conferences: [
    {conference_id: 7, name: "Sjever", color: BLUE},
    {conference_id: 8, name: "Jug", color: ORANGE},
  ],
  teams: [
    {team_id: 1, conference_id: 7},
    {team_id: 2, conference_id: 8},
    {team_id: 3, conference_id: 7},
    {team_id: 4, conference_id: 8},
  ],
};
const lookup = conferenceLookup(data);

test("the lookup gives each team its conference: null without one, undefined when the league has none", () => {
  assert.deepEqual(lookup.conferences.map((c) => c.name), ["Sjever", "Jug"]);
  assert.deepEqual(lookup.of(1), {id: 7, name: "Sjever", color: BLUE});
  assert.equal(lookup.of(4)?.name, "Jug");
  // in the league but in no conference, or the bye (team 0)
  assert.equal(lookup.of(5), null);
  assert.equal(lookup.of(0), null);
  const none = conferenceLookup({conferences: [], teams: []});
  assert.equal(none.of(1), undefined);
  assert.equal(conferenceLookup(null).of(1), undefined);
  assert.equal(conferenceDot(lookup.of(1)), BLUE);
  assert.equal(conferenceDot(lookup.of(5)), null);
  assert.equal(conferenceDot(none.of(1)), undefined);
});

const team = (id: number) => ({id, name: `T${id}`});

test("Create Round lists each pair of one conference once, without the bye", () => {
  const rounds = [
    [{teamOne: team(1), teamTwo: team(3)}, {teamOne: team(2), teamTwo: team(1)}, {teamOne: team(4), teamTwo: team(0)}],
    // the same pair again (a repeat) and a team without a conference
    [{teamOne: team(3), teamTwo: team(1)}, {teamOne: team(5), teamTwo: team(2)}, {teamOne: team(2), teamTwo: team(4)}],
  ];
  const found = sameConferencePairs(rounds, lookup.of);
  assert.deepEqual(
    found.map((p) => [p.teamOne.id, p.teamTwo.id, p.conference.name]),
    [
      [1, 3, "Sjever"],
      [2, 4, "Jug"],
    ]
  );
  assert.equal(sameConferencePairs(rounds, conferenceLookup(null).of).length, 0);
});

test("Distribute evenly deals the table out in snake order", () => {
  const order = [11, 12, 13, 14, 15, 16, 17];
  const plan = distributeEvenly(order, [1, 2, 3]);
  assert.deepEqual(
    plan.map((p) => p.conference_id),
    [1, 2, 3, 3, 2, 1, 1]
  );
  assert.deepEqual(plan.map((p) => p.team_id), order);
  const two = distributeEvenly([1, 2, 3, 4, 5], [7, 8]).map((p) => p.conference_id);
  assert.deepEqual(two, [7, 8, 8, 7, 7]);
  assert.deepEqual(distributeEvenly([1, 2], []), []);
});

const standings = [
  {team_id: 1, team: {team_name: "Dalmatinci"}, rounds_played: 6, wins: 5, draws: 0, losses: 1, point_difference: 61, score: 10},
  {team_id: 2, team: {team_name: "Slavonci"}, rounds_played: 6, wins: 4, draws: 1, losses: 1, point_difference: 38, score: 9},
  {team_id: 3, team: {team_name: "Zagorci"}, rounds_played: 6, wins: 4, draws: 0, losses: 2, point_difference: -5, score: 8},
  {team_id: 4, team: {team_name: "Istrani"}, rounds_played: 6, wins: 3, draws: 1, losses: 2, point_difference: 0, score: 7},
  {team_id: 5, team: {team_name: "Ličani"}, rounds_played: 6, wins: 2, draws: 0, losses: 4, point_difference: -20, score: 4},
  {team_id: 6, team: {team_name: "Purgeri"}, rounds_played: 6, wins: 1, draws: 0, losses: 5, point_difference: -30, score: 2},
];

test("a conference's table is the same table with only its teams, ranked from 1", () => {
  const rows = toStandingsRows(standings, [], lookup.of);
  assert.equal(rows[0].conference?.name, "Sjever");
  assert.equal(rows[4].conference, null);
  assert.equal(toStandingsRows(standings)[0].conference, undefined);

  const north = inConference(rows, 7);
  assert.deepEqual(north.map((r) => [r.rank, r.name, r.points]), [
    [1, "Dalmatinci", 10],
    [2, "Zagorci", 8],
  ]);
  const south = inConference(rows, 8);
  assert.deepEqual(south.map((r) => r.rank), [1, 2]);
  // two teams: no podium
  assert.equal(splitPodium(south).podium.length, 0);
  assert.equal(inConference(rows, null), rows);
});

test("round tables carry both teams' conferences", () => {
  const rounds = [
    {id: 1, table_number: 1, team1_id: 1, team2_id: 3, team1: {team_name: "Dalmatinci"}, team2: {team_name: "Zagorci"}},
    {id: 2, table_number: 2, team1_id: 2, team2_id: 1, team1: {team_name: "Slavonci"}, team2: {team_name: "Dalmatinci"}},
    {id: 3, table_number: 3, team1_id: 4, team2_id: 0, team1: {team_name: "Istrani"}, team2: {team_name: "Bye"}},
  ];
  const rows = toTableRows(rounds, [], lookup.of);
  assert.equal(rows[0].conferenceA?.name, "Sjever");
  assert.equal(rows[1].conferenceA?.name, "Jug");
  // the bye has no conference
  assert.equal(rows[2].conferenceB, null);
  assert.equal(toTableRows(rounds)[0].conferenceA, undefined);
});
