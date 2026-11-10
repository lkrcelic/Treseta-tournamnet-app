import assert from "node:assert/strict";
import {test} from "node:test";
import {leagueClock, leagueMoment} from "@/app/_lib/dates";
import {admittedFromWaiting, arrivalPhase, arrivalWindow, DayEntry, hasRoom, noShowStep, noShowTimes, startSwitch} from "@/app/_lib/tournamentDay";
import {addToDay, banActive, banDay, banDaysLeft, banUntil, untilLabel} from "@/app/_lib/bans";
import {tableState, StateTable} from "@/app/_lib/tableState";

// A tournament's day: the arrival window and the start time's switch, the no-show clock, the bans and the admin's
// table statuses

test("league time: a wall clock in Zagreb in winter and in summer", () => {
  assert.equal(leagueMoment("2026-10-31", "10:00").toISOString(), "2026-10-31T09:00:00.000Z");
  assert.equal(leagueMoment("2026-07-19", "09:30").toISOString(), "2026-07-19T07:30:00.000Z");
  // the night the clocks go back (25. 10. 2026): 01:30 is still summer time
  assert.equal(leagueMoment("2026-10-25", "01:30").toISOString(), "2026-10-24T23:30:00.000Z");
  assert.equal(leagueClock(new Date("2026-10-31T08:43:00Z")), "9:43");
});

test("Tu smo opens at Okupljanje and closes at Početak; without Okupljanje half an hour before", () => {
  const w = arrivalWindow({date: "2026-10-31", gathering_time: "09:30", start_time: "10:00"})!;
  assert.equal(w.opens.toISOString(), "2026-10-31T08:30:00.000Z");
  assert.equal(w.closes.toISOString(), "2026-10-31T09:00:00.000Z");
  assert.equal(arrivalPhase(w, new Date("2026-10-31T08:00:00Z")), "before");
  assert.equal(arrivalPhase(w, new Date("2026-10-31T08:45:00Z")), "open");
  assert.equal(arrivalPhase(w, new Date("2026-10-31T09:00:00Z")), "closed");
  // the switch ran early (Kolo 1 published): closed
  assert.equal(arrivalPhase(w, new Date("2026-10-31T08:45:00Z"), new Date()), "closed");
  const noGathering = arrivalWindow({date: "2026-10-31", gathering_time: null, start_time: "10:00"})!;
  assert.equal(noGathering.opens.toISOString(), "2026-10-31T08:30:00.000Z");
  assert.equal(arrivalWindow({date: "2026-10-31", gathering_time: "09:30", start_time: null}), null);
  assert.equal(arrivalPhase(null, new Date()), "none");
});

const entry = (teamId: number, status: "REGISTERED" | "WAITING", minute: number, arrived: boolean, extra: Partial<DayEntry> = {}): DayEntry => ({
  teamId,
  status,
  registeredAt: new Date(Date.UTC(2026, 9, 20, 12, minute)),
  arrived,
  active: true,
  excluded: false,
  ...extra,
});

test("at the start: unconfirmed teams become inactive, confirmed waiting teams come in up to the limit", () => {
  const entries = [
    entry(1, "REGISTERED", 1, true),
    entry(2, "REGISTERED", 2, false),
    entry(3, "REGISTERED", 3, true),
    entry(4, "REGISTERED", 4, false),
    entry(10, "WAITING", 5, false),
    entry(11, "WAITING", 6, true),
    entry(12, "WAITING", 7, true),
  ];
  // limit 4: two confirmed, two places free, but only 11 and 12 confirmed on the list
  assert.deepEqual(startSwitch(entries, 4), {inactive: [2, 4], admitted: [11, 12]});
  // limit 3: one place
  assert.deepEqual(startSwitch(entries, 3), {inactive: [2, 4], admitted: [11]});
  // no limit: nobody waits, the unconfirmed still become inactive
  assert.deepEqual(startSwitch(entries.slice(0, 4), null), {inactive: [2, 4], admitted: []});
});

test("during the tournament a place freed lets the first confirmed waiting team in", () => {
  const entries = [entry(1, "REGISTERED", 1, true), entry(2, "REGISTERED", 2, true, {active: false}), entry(10, "WAITING", 5, false), entry(11, "WAITING", 6, true)];
  assert.deepEqual(admittedFromWaiting(entries, 2), [11]);
  assert.equal(hasRoom(entries, 2), true);
  assert.equal(hasRoom([...entries.slice(0, 1), entry(3, "REGISTERED", 3, true)], 2), false);
  // an excluded team takes no place
  assert.equal(hasRoom([entry(1, "REGISTERED", 1, true), entry(3, "REGISTERED", 3, true, {excluded: true})], 2), true);
});

test("Nedolazak za stol: the question at 3, answers from 5, the skip at 8 minutes", () => {
  const out = new Date("2026-10-31T10:00:00Z");
  const times = noShowTimes(out);
  assert.equal(times.ask.toISOString(), "2026-10-31T10:03:00.000Z");
  assert.equal(times.unlock.toISOString(), "2026-10-31T10:05:00.000Z");
  assert.equal(times.skip.toISOString(), "2026-10-31T10:08:00.000Z");
  const at = (m: number, s = 0) => new Date(out.getTime() + m * 60_000 + s * 1000);
  assert.equal(noShowStep(out, at(2, 59)), "waiting");
  assert.equal(noShowStep(out, at(3)), "asking");
  assert.equal(noShowStep(out, at(5)), "answerable");
  assert.equal(noShowStep(out, at(7, 59)), "answerable");
  assert.equal(noShowStep(out, at(8)), "due");
});

test("a ban's length: weeks, months to the last day of a short month, years, Trajno", () => {
  assert.equal(addToDay("2026-10-29", 10, "days"), "2026-11-08");
  assert.equal(banUntil("2026-10-29", "week"), "2026-11-05");
  assert.equal(banUntil("2026-10-29", "month"), "2026-11-29");
  assert.equal(banUntil("2026-01-31", "month"), "2026-02-28");
  assert.equal(banUntil("2026-10-29", "3months"), "2027-01-29");
  assert.equal(banUntil("2026-10-29", "year"), "2027-10-29");
  assert.equal(banUntil("2026-10-29", "forever"), null);
  assert.equal(banUntil("2026-10-29", "custom", {n: 2, unit: "weeks"}), "2026-11-12");
  assert.equal(untilLabel("2026-11-08"), "Do 8. 11. 2026");
  assert.equal(untilLabel(null), "Bez isteka · dok admin ne ukine");
  assert.equal(banDay("2026-11-08"), "8. 11. 2026");
  assert.equal(banDaysLeft("2026-11-08", "2026-10-29"), 10);
});

test("a ban holds until its day, unless lifted", () => {
  assert.equal(banActive({until: "2026-11-08", lifted: false}, "2026-11-07"), true);
  assert.equal(banActive({until: "2026-11-08", lifted: false}, "2026-11-08"), false);
  assert.equal(banActive({until: null, lifted: false}, "2030-01-01"), true);
  assert.equal(banActive({until: null, lifted: true}, "2026-11-01"), false);
});

const base: StateTable = {
  status: "PUBLISHED",
  open: true,
  bye: false,
  published_at: new Date("2026-10-31T10:00:00Z"),
  started: false,
  attendance: null,
  attendance_at: null,
  answered_by: null,
  other: null,
  matches: [],
  team1: "Istrani",
  team2: "Imoćani",
  matches_per_round: 2,
  today: true,
};
const clock = (d: Date) => leagueClock(d);

test("the admin's table statuses", () => {
  const at = (m: number, s = 0) => new Date(Date.parse("2026-10-31T10:00:00Z") + m * 60_000 + s * 1000);
  assert.equal(tableState(base, at(2), 35, clock).label, "Novo");
  const asking = tableState(base, at(6, 8), 35, clock);
  assert.equal(asking.kind, "asking");
  assert.equal(asking.label, "Upit · 1:52");
  assert.equal(asking.note, "Igra nije počela. U 11:08 obje ekipe ispadaju iz turnira.");
  assert.equal(tableState({...base, started: true}, at(20), 35, clock).label, "Uživo");
  const noShow = tableState({...base, open: false, attendance: "NO_SHOW", attendance_at: at(8), answered_by: "Dalmatinci", other: "Purgeri"}, at(9), 35, clock);
  assert.equal(noShow.label, "Nedolazak");
  assert.equal(noShow.note, "Dalmatinci prijavili u 11:08 · 5 : 0 po partiji · Purgeri isključeni");
  assert.equal(tableState({...base, open: false, attendance: "SKIPPED", attendance_at: at(10)}, at(11), 35, clock).label, "Preskočen");
  const expired = tableState(
    {...base, started: true, matches: [{score1: 1010, score2: 700, time_expired: false}, {score1: 640, score2: 588, time_expired: true}], open: false},
    at(80),
    35,
    clock
  );
  assert.equal(expired.label, "Vrijeme isteklo");
  assert.equal(expired.note, "Partija 2 završena nakon 35 min s upisanim rezultatom. Pobjeđuju Istrani.");
  assert.equal(tableState({...base, open: false, started: true, matches: [{score1: 1001, score2: 700, time_expired: false}]}, at(80), 35, clock).label, "Gotovo");
  // a table of another day never asks
  assert.equal(tableState({...base, today: false}, at(9), 35, clock).label, "Novo");
});
