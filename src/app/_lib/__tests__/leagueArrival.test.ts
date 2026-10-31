import assert from "node:assert/strict";
import {test} from "node:test";
import {arrivalEffect, isHere, leagueArrivalPhase, leagueArrivalWindow} from "@/app/_lib/leagueArrival";

// Potvrda dolaska in the league: the window and what each button does

test("Tu smo opens half an hour before the night's start and holds until 06:00 the next morning", () => {
  const w = leagueArrivalWindow("2026-11-04", "20:00")!;
  assert.equal(w.opens.toISOString(), "2026-11-04T18:30:00.000Z");
  assert.equal(w.start.toISOString(), "2026-11-04T19:00:00.000Z");
  assert.equal(w.closes.toISOString(), "2026-11-05T05:00:00.000Z");
  assert.equal(leagueArrivalPhase(w, new Date("2026-11-04T18:00:00Z")), "before");
  assert.equal(leagueArrivalPhase(w, new Date("2026-11-04T18:30:00Z")), "open");
  assert.equal(leagueArrivalPhase(w, new Date("2026-11-04T19:00:00Z")), "started");
  // past midnight the night is still on
  assert.equal(leagueArrivalPhase(w, new Date("2026-11-05T01:30:00Z")), "started");
  assert.equal(leagueArrivalPhase(w, new Date("2026-11-05T05:00:00Z")), "over");
  // the screens get the times as ISO strings
  assert.equal(leagueArrivalPhase({opens: w.opens.toISOString(), start: w.start.toISOString(), closes: w.closes.toISOString()}, new Date("2026-11-04T18:45:00Z")), "open");
  // summer time: 19:30 in Zagreb is 17:30 UTC
  assert.equal(leagueArrivalWindow("2026-07-15", "19:30")!.start.toISOString(), "2026-07-15T17:30:00.000Z");
  // a night without a start time has no confirmation
  assert.equal(leagueArrivalWindow("2026-11-04", null), null);
});

test("with an Okupljanje, Tu smo opens then; one that isn't before the start doesn't count", () => {
  const w = leagueArrivalWindow("2026-11-04", "20:00", "19:00")!;
  assert.equal(w.opens.toISOString(), "2026-11-04T18:00:00.000Z");
  assert.equal(w.start.toISOString(), "2026-11-04T19:00:00.000Z");
  assert.equal(leagueArrivalPhase(w, new Date("2026-11-04T18:10:00Z")), "open");
  // at or after the start: half an hour before, as without one
  assert.equal(leagueArrivalWindow("2026-11-04", "20:00", "20:00")!.opens.toISOString(), "2026-11-04T18:30:00.000Z");
  assert.equal(leagueArrivalWindow("2026-11-04", "20:00", "21:00")!.opens.toISOString(), "2026-11-04T18:30:00.000Z");
  assert.equal(leagueArrivalWindow("2026-11-04", "20:00", null)!.opens.toISOString(), "2026-11-04T18:30:00.000Z");
  // an Okupljanje without a Početak still has no confirmation
  assert.equal(leagueArrivalWindow("2026-11-04", null, "19:00"), null);
});

test("a team is here while it has come and hasn't left", () => {
  assert.equal(isHere(null), false);
  assert.equal(isHere({left_at: null}), true);
  assert.equal(isHere({left_at: "2026-11-04T21:10:00.000Z"}), false);
});

test("Tu smo works once the window is open; leaving is Ipak otkazujemo before the start and Odlazimo after it", () => {
  assert.equal(arrivalEffect("before", "confirm", false), "not_open");
  assert.equal(arrivalEffect("open", "confirm", false), "arrive");
  assert.equal(arrivalEffect("open", "confirm", true), "none");
  assert.equal(arrivalEffect("started", "confirm", false), "arrive");
  assert.equal(arrivalEffect("over", "confirm", false), "over");
  assert.equal(arrivalEffect("open", "leave", true), "withdraw");
  // switched on by the admin before the window opened
  assert.equal(arrivalEffect("before", "leave", true), "withdraw");
  assert.equal(arrivalEffect("started", "leave", true), "leave");
  assert.equal(arrivalEffect("started", "leave", false), "none");
  assert.equal(arrivalEffect("over", "leave", true), "over");
});
