import assert from "node:assert/strict";
import {test} from "node:test";
import {homeCard, TonightTeam} from "../homeCard";
import {byTeamName, copyText, isSlot, isTwoPlaceNight, otherSlot, splitByConference, swapSlots} from "../locations";
import {nightKolo, placeLastPublished, publishNumbers, RoundStatus} from "../roundStatus";

// Liga na dvije lokacije (LOCATIONS_PLAN.md): slots, Podjela's helpers, the shared Kolo numbers and the home card.

test("a place of a two-place night is slot 1 or 2", () => {
  assert.equal(isSlot(1), true);
  assert.equal(isSlot(2), true);
  for (const v of [0, 3, null, undefined, "1"]) assert.equal(isSlot(v), false);
  assert.equal(otherSlot(1), 2);
  assert.equal(otherSlot(2), 1);
  assert.equal(isTwoPlaceNight({second_location_id: 4}), true);
  assert.equal(isTwoPlaceNight({second_location_id: null}), false);
  assert.equal(isTwoPlaceNight({second_location_id: undefined}), false);
});

test("teams are sorted the Croatian way, case aside", () => {
  const names = ["Špicom u stomak", "Sinjski alkari", "čvorci", "Cvjetići", "Akužavci", "astletičari"];
  assert.deepEqual(
    names.map((name) => ({name})).sort(byTeamName).map((t) => t.name),
    ["Akužavci", "astletičari", "Cvjetići", "čvorci", "Sinjski alkari", "Špicom u stomak"]
  );
});

test("Podijeli po konferencijama: the first conference goes to the first place, the second to the second", () => {
  const conferences = [
    {conference_id: 20, position: 1},
    {conference_id: 10, position: 0},
  ];
  const teams = [
    {team_id: 1, conference_id: 10, active: true},
    {team_id: 2, conference_id: 20, active: true},
    {team_id: 3, conference_id: 10, active: false},
    {team_id: 4, conference_id: null, active: true},
    {team_id: 5, conference_id: 20, active: true},
  ];
  const split = splitByConference(teams, conferences);
  assert.ok(split);
  // conference 10 is first in the league's list
  assert.deepEqual(
    Array.from(split).sort((a, b) => a[0] - b[0]),
    [
      [1, 1],
      [2, 2],
      [5, 2],
    ]
  );
  // inactive teams and teams without a conference are left out
  assert.equal(split.has(3), false);
  assert.equal(split.has(4), false);
});

test("Podijeli po konferencijama works only with exactly two conferences", () => {
  const teams = [{team_id: 1, conference_id: 10, active: true}];
  assert.equal(splitByConference(teams, []), null);
  assert.equal(splitByConference(teams, [{conference_id: 10, position: 0}]), null);
  const three = [10, 20, 30].map((id, i) => ({conference_id: id, position: i}));
  assert.equal(splitByConference(teams, three), null);
});

test("Zamijeni lokacije sends every assigned team to the other place", () => {
  const swapped = swapSlots(
    new Map([
      [1, 1],
      [2, 2],
      [3, 1],
    ])
  );
  assert.deepEqual(Array.from(swapped), [
    [1, 2],
    [2, 1],
    [3, 2],
  ]);
  assert.equal(swapSlots(new Map()).size, 0);
});

test("Kopiraj raspored: each place and its teams alphabetically, a blank line between places", () => {
  const text = copyText([
    {name: "Kartaš", teams: ["Mujo i Haso", "Alen Kitasović", "Špicom u stomak", "Barcelona"]},
    {name: "Lanterna", teams: ["Zadnja ruka", "Akužavci"]},
  ]);
  assert.equal(
    text,
    ["Kartaš", "• Alen Kitasović", "• Barcelona", "• Mujo i Haso", "• Špicom u stomak", "", "Lanterna", "• Akužavci", "• Zadnja ruka"].join("\n")
  );
  // a place without teams is just its name
  assert.equal(copyText([{name: "Kartaš", teams: []}, {name: "Lanterna", teams: ["Akužavci"]}]), "Kartaš\n\nLanterna\n• Akužavci");
});

// a round of tonight at one place: its number now, status and Skica letter order
const r = (roundNumber: number, status: RoundStatus, draftOrder: number | null = null) => ({roundNumber, status, draftOrder});

test("both places of a night share the Kolo numbers: Kartaš 7, 8, 9 and Lanterna 7, 8", () => {
  // the league's last published round before tonight is Kolo 6
  const beforeNight = 6;
  // Kartaš publishes its three Kola first
  const kartas = publishNumbers([r(101, "APPROVED", 1), r(102, "APPROVED", 2), r(103, "APPROVED", 3)], placeLastPublished(beforeNight, []));
  assert.deepEqual([kartas.get(101), kartas.get(102), kartas.get(103)], [7, 8, 9]);
  // Lanterna starts from 7 too, whatever Kartaš published
  const lanterna = publishNumbers([r(201, "APPROVED", 1), r(202, "APPROVED", 2)], placeLastPublished(beforeNight, []));
  assert.deepEqual([lanterna.get(201), lanterna.get(202)], [7, 8]);
  // the next night starts after the highest: 10
  assert.equal(placeLastPublished(9, []) + 1, 10);
});

test("a place that published some Kola tonight goes on after its own", () => {
  // Lanterna published Kolo 7 earlier; its new Skica becomes Kolo 8, not 10 after Kartaš's 9
  const lanterna = publishNumbers([r(301, "APPROVED", 1)], placeLastPublished(6, [7]));
  assert.equal(lanterna.get(301), 8);
  // the place that publishes second in time still starts at 7
  const kartas = publishNumbers([r(401, "APPROVED", 1)], placeLastPublished(6, []));
  assert.equal(kartas.get(401), 7);
});

test("Kolo 1/3: which of the place's published Kola tonight a table is", () => {
  assert.deepEqual(nightKolo(7, [7, 8, 9]), [1, 3]);
  assert.deepEqual(nightKolo(9, [9, 7, 8]), [3, 3]);
  // the numbers come once per table
  assert.deepEqual(nightKolo(8, [7, 7, 8, 8, 9, 9]), [2, 3]);
  // a Kolo added later makes it out of 4
  assert.deepEqual(nightKolo(7, [7, 8, 9, 10]), [1, 4]);
  assert.equal(nightKolo(11, [7, 8, 9]), null);
});

const tonight = (over: Partial<TonightTeam> = {}): TonightTeam => ({started: true, here: true, lastTable: null, lastKoloOut: false, ...over});
const played = (k: number, n: number, bye = false) => ({kolo: [k, n] as [number, number], bye});

test("a table to play or being played comes first", () => {
  assert.equal(homeCard({openTable: true, tonight: tonight({lastTable: played(3, 3), lastKoloOut: true}), nextNight: true}), "table");
});

test("before the team's first table the night's card shows (Tu ste · Igrate u idućem kolu)", () => {
  assert.equal(homeCard({openTable: false, tonight: tonight(), nextNight: true}), "night");
  // before the start and after leaving, the night's card says it
  assert.equal(homeCard({openTable: false, tonight: tonight({started: false}), nextNight: true}), "night");
  assert.equal(homeCard({openTable: false, tonight: tonight({here: false, lastTable: played(1, 3)}), nextNight: true}), "night");
});

test("Sljedeći stol after a table that isn't the place's last", () => {
  assert.equal(homeCard({openTable: false, tonight: tonight({lastTable: played(1, 3)}), nextNight: true}), "next");
  // the last of the Kola made so far, while the place hasn't made all of tonight's yet
  assert.equal(homeCard({openTable: false, tonight: tonight({lastTable: played(2, 2), lastKoloOut: false}), nextNight: true}), "next");
});

test("Pauza for a bye that isn't in the last Kolo", () => {
  assert.equal(homeCard({openTable: false, tonight: tonight({lastTable: played(2, 3, true), lastKoloOut: true}), nextNight: true}), "bye");
  assert.equal(homeCard({openTable: false, tonight: tonight({lastTable: played(2, 2, true), lastKoloOut: false}), nextNight: true}), "bye");
});

test("Kraj večeri after the table in the place's last Kolo, or a bye in it", () => {
  assert.equal(homeCard({openTable: false, tonight: tonight({lastTable: played(3, 3), lastKoloOut: true}), nextNight: true}), "end");
  assert.equal(homeCard({openTable: false, tonight: tonight({lastTable: played(3, 3, true), lastKoloOut: true}), nextNight: false}), "end");
  // the admin made a fourth Kolo: Kolo 3 is no longer the last
  assert.equal(homeCard({openTable: false, tonight: tonight({lastTable: played(3, 4), lastKoloOut: true}), nextNight: true}), "next");
});

test("with no night tonight: the next night's card, else Nema zakazane večeri", () => {
  assert.equal(homeCard({openTable: false, tonight: null, nextNight: true}), "night");
  assert.equal(homeCard({openTable: false, tonight: null, nextNight: false}), "none");
});
