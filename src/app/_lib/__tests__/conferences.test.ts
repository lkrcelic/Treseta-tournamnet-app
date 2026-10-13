import assert from "node:assert/strict";
import {test} from "node:test";
import {
  CONFERENCE_COLORS,
  conferenceDot,
  conferenceGroups,
  conferenceLookup,
  conferencesError,
  distributeEvenly,
  MAX_CONFERENCES,
  nextFreeColor,
} from "../conferences";
import {inConference, splitPodium, toStandingsRows} from "../ui/standings";
import {toTableRows} from "../ui/tables";
import {generateGroupedRoundPairings} from "../matching/multipleRoundMatching";
import {BYE_TEAM_ID} from "../bye";

const BLUE = CONFERENCE_COLORS[0].hex;
const ORANGE = CONFERENCE_COLORS[1].hex;
const TEAL = CONFERENCE_COLORS[2].hex;

test("a league has no conferences or 2–6, named and colored from the palette, none twice", () => {
  assert.equal(conferencesError([]), null);
  assert.equal(conferencesError([{name: "Sjever", color: BLUE}, {name: "Jug", color: ORANGE}]), null);
  // the hex may come in lower case
  assert.equal(conferencesError([{name: "Sjever", color: BLUE.toLowerCase()}, {name: "Jug", color: ORANGE}]), null);
  assert.match(conferencesError([{name: "Sjever", color: BLUE}]) ?? "", /barem 2/);
  const seven = Array.from({length: MAX_CONFERENCES + 1}, (_, i) => ({name: `K${i}`, color: CONFERENCE_COLORS[i % MAX_CONFERENCES].hex}));
  assert.match(conferencesError(seven) ?? "", /najviše 6 konferencija/);
  assert.match(conferencesError([{name: " ", color: BLUE}, {name: "Jug", color: ORANGE}]) ?? "", /treba ime/);
  assert.match(conferencesError([{name: "Sjever", color: BLUE}, {name: " sjever ", color: ORANGE}]) ?? "", /isto ime/);
  assert.match(conferencesError([{name: "Sjever", color: BLUE}, {name: "Jug", color: BLUE}]) ?? "", /istu boju/);
  assert.match(conferencesError([{name: "Sjever", color: "#FF0000"}, {name: "Jug", color: ORANGE}]) ?? "", /palete/);
  assert.match(conferencesError([{name: "x".repeat(41), color: BLUE}, {name: "Jug", color: ORANGE}]) ?? "", /najviše 40 znakova/);
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

test("Only within conferences groups tonight's teams by conference, the teams without one last", () => {
  const groups = conferenceGroups([team(1), team(2), team(3), team(5)], lookup);
  assert.deepEqual(
    groups.map((g) => [g.name, g.teams.map((t) => t.id)]),
    [
      ["Sjever", [1, 3]],
      ["Jug", [2]],
      ["Ekipe bez konferencije", [5]],
    ]
  );
  assert.deepEqual(conferenceGroups([team(1), team(3)], lookup).map((g) => g.teams.length), [2, 0]);
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

const ranked = (ids: number[]) =>
  ids.map((id, i) => ({id, name: `T${id}`, score: 100 - i, point_difference: 0, played_against: [] as number[]}));

test("Only within conferences: teams meet only teams of their conference, each odd conference with its own bye", () => {
  const north = ranked([1, 2, 3, 4, 5, 6, 7]);
  const south = ranked([11, 12, 13, 14, 15, 16]);
  const plan = generateGroupedRoundPairings(
    [
      {name: "Sjever", teams: north},
      {name: "Jug", teams: south},
    ],
    {windowSize: 8, numberOfRounds: 3}
  );
  assert.equal(plan.rounds.length, 3);
  assert.equal(plan.repeats.length, 0);
  const side = (id: number) => (id < 10 ? "N" : "S");
  for (const round of plan.rounds) {
    const ids = round.flatMap((p) => [p.teamOne.id, p.teamTwo.id]).filter((id) => id !== BYE_TEAM_ID);
    assert.equal(ids.length, 13);
    assert.equal(new Set(ids).size, 13);
    const byes = round.filter((p) => p.teamTwo.id === BYE_TEAM_ID || p.teamOne.id === BYE_TEAM_ID);
    assert.equal(byes.length, 1);
    // the bye comes after every real table
    assert.equal(round[round.length - 1], byes[0]);
    for (const p of round) if (!byes.includes(p)) assert.equal(side(p.teamOne.id), side(p.teamTwo.id));
  }
  // too few teams in one conference for the rounds
  assert.throws(
    () => generateGroupedRoundPairings([{name: "Jug", teams: ranked([11, 12, 13])}, {name: "Sjever", teams: north}], {windowSize: 8, numberOfRounds: 3}),
    /Jug večeras ima 3 ekipe, premalo za 3 kola/
  );
});
