import assert from "node:assert/strict";
import {test} from "node:test";
import {
  LeagueCreateRequestValidation,
  LeagueNightAddRequestValidation,
  LeagueNightUpdateRequestValidation,
  LeagueUpdateRequestValidation,
  START_TIME_ERROR,
} from "../../_interfaces/league";
import {effectiveTime, isStartTime, nightTimeLabel, timeLabel} from "../nights";
import {zodMessage} from "../validation/zodMessage";

// When a league night starts (Raspored, Početna, Upravljanje ligom · Podaci and Datumi)

test("a start time is a wall-clock HH:MM from 00:00 to 23:59", () => {
  for (const t of ["00:00", "07:05", "19:30", "20:00", "23:59"]) assert.equal(isStartTime(t), true, t);
  for (const t of ["24:00", "23:60", "7:30", "19:3", "19.30", "1930", "19:30:00", " 19:30", "", "ab:cd"]) assert.equal(isStartTime(t), false, t);
});

test("a night starts at its own time, else the league's, else at none", () => {
  assert.equal(effectiveTime("19:30", "20:00"), "19:30");
  assert.equal(effectiveTime(null, "20:00"), "20:00");
  assert.equal(effectiveTime(undefined, "20:00"), "20:00");
  assert.equal(effectiveTime("19:30", null), "19:30");
  assert.equal(effectiveTime(null, null), null);
});

test("a night's label gives its time after the date, or only the date", () => {
  assert.equal(nightTimeLabel("2026-10-14", "19:00"), "sri 14. 10. · 19:00");
  assert.equal(nightTimeLabel("2026-10-14", null), "sri 14. 10.");
  assert.equal(nightTimeLabel("2026-10-14", undefined), "sri 14. 10.");
  assert.equal(timeLabel("20:00"), "20:00");
  assert.equal(timeLabel(null), "—");
});

const message = (result: {success: boolean; error?: Parameters<typeof zodMessage>[0]}) => (result.error ? zodMessage(result.error, "fallback") : null);

test("the server takes an optional HH:MM start time for the league and its nights, in Croatian when it's wrong", () => {
  assert.equal(LeagueCreateRequestValidation.safeParse({league_name: "Jesen"}).success, true);
  assert.equal(LeagueCreateRequestValidation.parse({league_name: "Jesen", start_time: "20:00"}).start_time, "20:00");
  assert.equal(LeagueCreateRequestValidation.parse({league_name: "Jesen", start_time: null}).start_time, null);
  assert.equal(message(LeagueCreateRequestValidation.safeParse({league_name: "Jesen", start_time: "25:00"})), START_TIME_ERROR);
  assert.equal(message(LeagueCreateRequestValidation.safeParse({league_name: "Jesen", start_time: 2000})), START_TIME_ERROR);

  assert.equal(LeagueUpdateRequestValidation.parse({start_time: null}).start_time, null);
  assert.equal(LeagueUpdateRequestValidation.parse({}).start_time, undefined);
  assert.equal(message(LeagueUpdateRequestValidation.safeParse({start_time: ""})), START_TIME_ERROR);

  assert.equal(LeagueNightAddRequestValidation.parse({date: "2026-10-14"}).start_time, undefined);
  assert.equal(LeagueNightAddRequestValidation.parse({date: "2026-10-14", start_time: "19:30"}).start_time, "19:30");
  assert.equal(message(LeagueNightAddRequestValidation.safeParse({date: "2026-10-14", start_time: "19:30:00"})), START_TIME_ERROR);

  // null takes the night back to the league's time; the field can't be left out
  assert.equal(LeagueNightUpdateRequestValidation.parse({start_time: null}).start_time, null);
  assert.equal(LeagueNightUpdateRequestValidation.safeParse({}).success, false);
  assert.equal(message(LeagueNightUpdateRequestValidation.safeParse({start_time: "8:00"})), START_TIME_ERROR);
});
