import assert from "node:assert/strict";
import {test} from "node:test";
import {draftNight, inKolaRow, kolaRows, newRoundsLabel, nightRounds, placesTonight, placeStatus, publishedLabel, publishedTonight, tonightEyebrow, tonightRoundsDefault, tonightState, waitingLabel} from "../ui/adminTonight";

const r = (date: string, status: "draft" | "approved" | "played" | "live" | "new") => ({date, status});

test("Skica shows the night asked for, else the latest night with rounds still to publish", () => {
  const rounds = [r("2026-10-08", "played"), r("2026-10-15", "approved"), r("2026-10-15", "draft"), r("2026-10-15", "new")];
  assert.deepEqual(draftNight(rounds), {date: "2026-10-15", waiting: 2, approved: 1});
  // a night with rounds is shown even when everything is published ("Sva kola su objavljena")
  assert.deepEqual(draftNight(rounds, "2026-10-08"), {date: "2026-10-08", waiting: 0, approved: 0});
  // a night without rounds falls back to the waiting one
  assert.deepEqual(draftNight(rounds, "2026-10-22"), {date: "2026-10-15", waiting: 2, approved: 1});
  assert.equal(draftNight([r("2026-10-08", "played")]), null);
  assert.equal(draftNight(null), null);
});

test("the waiting rounds read in Croatian", () => {
  assert.equal(waitingLabel(1, 0), "1 kolo nije objavljeno");
  assert.equal(waitingLabel(3, 1), "3 kola nisu objavljena · 1 odobreno");
  assert.equal(waitingLabel(2, 2), "2 kola nisu objavljena · 2 odobrena");
  assert.equal(waitingLabel(5, 5), "5 kola nije objavljeno · 5 odobreno");
});

const t = (round: number, done: boolean, started = done, bye = false) => ({round, done, started, bye});

test("tonight is the first round with an open table, counted with the night's unpublished rounds", () => {
  assert.deepEqual(tonightState([], 3), {kind: "none"});
  const tables = [t(1, true), t(1, true), t(1, false, true), t(2, false), t(2, false)];
  const state = tonightState(tables, 3);
  assert.deepEqual(state, {kind: "playing", round: 1, rounds: 3, done: 2, tables: 3, started: true});
  assert.equal(tonightEyebrow(state as Extract<typeof state, {kind: "playing"}>), "Kolo 1 od 3 · u tijeku");
  assert.deepEqual(tonightState([t(1, true), t(2, true)]), {kind: "finished", rounds: 2});
});

test("a round where only the bye is settled hasn't started", () => {
  const state = tonightState([t(2, true, true, true), t(2, false), t(1, true)], 2);
  assert.deepEqual(state, {kind: "playing", round: 2, rounds: 2, done: 1, tables: 2, started: false});
  assert.equal(tonightEyebrow(state as Extract<typeof state, {kind: "playing"}>), "Kolo 2 od 2 · nije počelo");
});

// a round of the Kola list at a place of a two-place night
type St = "draft" | "approved" | "played" | "live" | "new";
const k = (date: string, slot: number | null, roundNumber: number, status: St, tables = 2, letter: string | null = null) => ({date, slot, roundNumber, status, tables, letter});

test("a two-place night's Skica is each place's own", () => {
  const rounds = [k("2026-11-19", 1, 7, "played"), k("2026-11-19", 1, 9, "draft"), k("2026-11-19", 2, 7, "live"), k("2026-11-19", 2, 8, "approved")];
  assert.deepEqual(draftNight(rounds, null, 1), {date: "2026-11-19", waiting: 1, approved: 0});
  assert.deepEqual(draftNight(rounds, null, 2), {date: "2026-11-19", waiting: 1, approved: 1});
  // both places together, as the Skica tab counts them
  assert.deepEqual(draftNight(rounds), {date: "2026-11-19", waiting: 2, approved: 1});
});

test("the Kola tab shows both places' Kolo 7 as one row, and each place's Skica apart", () => {
  const rounds = [
    k("2026-11-19", 1, 8, "draft", 2, "A"),
    k("2026-11-19", 2, 8, "new", 3),
    k("2026-11-19", 1, 7, "played", 4),
    k("2026-11-19", 2, 7, "live", 3),
    k("2026-11-12", null, 6, "played", 5),
  ];
  const rows = kolaRows(rounds);
  assert.deepEqual(
    rows.map((r) => [r.roundNumber, r.slot, r.status, r.tables]),
    [
      [8, 1, "draft", 2],
      // Lanterna's Kolo 8 has no partner at Kartaš yet: its own row
      [8, 2, "new", 3],
      // Kartaš played its Kolo 7, Lanterna's is on: the Kolo is on, with all 7 tables
      [7, null, "live", 7],
      [6, null, "played", 5],
    ]
  );
  // Obriši on the merged Kolo 7 takes both places' rounds, not Kolo 8
  assert.deepEqual(
    rounds.filter((r) => inKolaRow(rows[2], r)).map((r) => [r.roundNumber, r.slot]),
    [
      [7, 1],
      [7, 2],
    ]
  );
  // a Skica row is its own
  assert.deepEqual(rounds.filter((r) => inKolaRow(rows[0], r)).map((r) => r.slot), [1]);
  // both played: played
  assert.equal(kolaRows([k("d", 1, 7, "played"), k("d", 2, 7, "played")])[0].status, "played");
  assert.equal(kolaRows([k("d", 1, 7, "new"), k("d", 2, 7, "new")])[0].status, "new");
  assert.equal(kolaRows([k("d", 1, 7, "played"), k("d", 2, 7, "new")])[0].status, "live");
});

test("the place picker says how each place is doing", () => {
  const rounds = [k("n", 1, 7, "played"), k("n", 1, 8, "live"), k("n", 2, 7, "played"), k("n", 2, 9, "draft")];
  assert.deepEqual(placeStatus(rounds, "n", 1), {text: "kolo 8 u tijeku", short: "kolo 8", live: true});
  assert.deepEqual(placeStatus(rounds, "n", 2), {text: "skica čeka", short: "skica", live: false});
  assert.deepEqual(placeStatus([k("n", 1, 7, "played"), k("n", 1, 8, "new")], "n", 1), {text: "kolo 8 objavljeno", short: "kolo 8", live: false});
  assert.deepEqual(placeStatus([k("n", 1, 7, "played")], "n", 1), {text: "kolo 7 odigrano", short: "kolo 7", live: false});
  assert.deepEqual(placeStatus(rounds, "other night", 1), {text: "još nema kola", short: "bez kola", live: false});
});

test("Večer at two places: each place goes at its own pace", () => {
  const night = "2026-11-19";
  // Lanterna (2) plays its Kolo 8 (1 of 2 tables done); Kartaš (1) has Skica A–C waiting, one approved
  const tables = [
    {round: 7, done: true, started: true, bye: false, slot: 2},
    {round: 8, done: true, started: true, bye: false, slot: 2},
    {round: 8, done: false, started: true, bye: false, slot: 2},
  ];
  const rounds = [
    k(night, 1, 9, "draft", 2, "A"),
    k(night, 1, 10, "approved", 2, "B"),
    k(night, 1, 11, "draft", 2, "C"),
    k(night, 2, 7, "played"),
    k(night, 2, 8, "live"),
    k(night, 2, 9, "draft", 2, "C"),
    k("2026-11-12", null, 6, "played"),
  ];
  const [kartas, lanterna] = placesTonight(tables, rounds, night);
  assert.deepEqual(kartas, {slot: 1, state: {kind: "none"}, waiting: 3, approved: 1, kolo: null, kola: 3});
  // Lanterna plays Kolo 8, its 2nd of 3 tonight (7, 8 and a Skica), half done; its own Skica counts as waiting
  assert.deepEqual(lanterna.kolo, [2, 3]);
  assert.deepEqual([lanterna.state.kind, lanterna.state.kind === "playing" && [lanterna.state.done, lanterna.state.tables]], ["playing", [1, 2]]);
  assert.equal(lanterna.waiting, 1);
});

const n = (date: string, roundNumber: number, status: "draft" | "approved" | "played" | "live" | "new") => ({date, roundNumber, status});

test("Novo kolo counts tonight's published rounds and numbers the new ones after them", () => {
  const rounds = [n("2026-11-10", 1, "played"), n("2026-11-10", 2, "played"), n("2026-11-10", 3, "live"), n("2026-11-10", 0, "draft"), n("2026-11-03", 5, "played")];
  assert.deepEqual(publishedTonight(rounds, "2026-11-10"), {published: 3, live: 1, next: 4});
  // only Skica tonight, or nothing: Novo kolo starts the night
  assert.equal(publishedTonight([n("2026-11-10", 0, "draft"), n("2026-11-10", 0, "approved")], "2026-11-10"), null);
  assert.equal(publishedTonight(rounds, "2026-11-17"), null);
  assert.equal(publishedTonight(null, "2026-11-10"), null);
  assert.equal(publishedLabel({published: 3, live: 1, next: 4}), "Večeras su već objavljena 3 kola (1 u tijeku)");
  assert.equal(publishedLabel({published: 1, live: 0, next: 2}), "Večeras je već objavljeno 1 kolo");
  assert.equal(publishedLabel({published: 5, live: 0, next: 6}), "Večeras je već objavljeno 5 kola");
  assert.equal(newRoundsLabel(4, 1), "Kolo 4");
  assert.equal(newRoundsLabel(4, 3), "Kolo 4–6");
});

test("at a place of a two-place night, Novo kolo counts and numbers that place's own Kola", () => {
  // the night's Kola go on from Kolo 7: Kartaš (1) has played 7 and 8, Lanterna (2) plays its 7; Kartaš's Skica waits
  const rounds = [k("2026-11-19", 1, 7, "played"), k("2026-11-19", 1, 8, "played"), k("2026-11-19", 2, 7, "live"), k("2026-11-19", 1, 9, "draft", 2, "A")];
  assert.deepEqual(publishedTonight(rounds, "2026-11-19", 1), {published: 2, live: 0, next: 9});
  assert.deepEqual(publishedTonight(rounds, "2026-11-19", 2), {published: 1, live: 1, next: 8});
  // a place with nothing published yet starts its part of the night
  assert.equal(publishedTonight([k("2026-11-19", 1, 7, "played")], "2026-11-19", 2), null);
});

test("Novo kolo offers tonight's Broj kola, and once some are published the ones still missing", () => {
  const nights = [
    {date: "2026-11-18", rounds_per_night: 3},
    {date: "2026-11-25", rounds_per_night: null},
  ];
  // the night's own, else the league's
  assert.equal(nightRounds(nights, "2026-11-18", 4), 3);
  assert.equal(nightRounds(nights, "2026-11-25", 4), 4);
  assert.equal(nightRounds(nights, "2026-12-02", 4), 4);
  assert.equal(nightRounds(null, "2026-11-18", 4), 4);
  assert.equal(tonightRoundsDefault(3, null), 3);
  assert.equal(tonightRoundsDefault(4, {published: 1, live: 1, next: 2}), 3);
  // after the night's last round an extra one is still offered
  assert.equal(tonightRoundsDefault(3, {published: 3, live: 0, next: 4}), 1);
  assert.equal(tonightRoundsDefault(undefined, {published: 2, live: 0, next: 3}), 1);
});

test("at a place of a two-place night, Novo kolo offers the night's Broj kola less that place's own published Kola", () => {
  // tonight plays 3 Kola (its own Broj kola; the league plays 2); Kartaš (1) has published 2, Lanterna (2) 1
  const nights = [{date: "2026-11-19", rounds_per_night: 3}];
  const rounds = [k("2026-11-19", 1, 7, "played"), k("2026-11-19", 1, 8, "live"), k("2026-11-19", 2, 7, "live"), k("2026-11-19", 2, 8, "draft", 2, "A")];
  const planned = nightRounds(nights, "2026-11-19", 2);
  assert.equal(tonightRoundsDefault(planned, publishedTonight(rounds, "2026-11-19", 1)), 1);
  // Lanterna's Skica doesn't count: 3 less its one published Kolo
  assert.equal(tonightRoundsDefault(planned, publishedTonight(rounds, "2026-11-19", 2)), 2);
  // a place with nothing published yet starts with the whole Broj kola
  assert.equal(tonightRoundsDefault(planned, publishedTonight([k("2026-11-19", 1, 7, "played")], "2026-11-19", 2)), 3);
});
