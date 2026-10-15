import assert from "node:assert/strict";
import {test} from "node:test";
import {draftNight, tonightEyebrow, tonightState, waitingLabel} from "../ui/adminTonight";

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
