import assert from "node:assert/strict";
import {test} from "node:test";
import {CreateRoundDraftValidation, createRoundNight, isPlaying, switchTeams} from "../createRoundDraft";

// Novo kolo remembers what each admin set up for a league tonight; the teams sitting out are taken at the first change,
// so the active switches on Ekipe don't move the list after that.

const teams = [
  {id: 1, active: true},
  {id: 2, active: true},
  {id: 3, active: false},
];

test("the night: Zagreb time, and until 06:00 still the night before", () => {
  // 21:00 in Zagreb (summer time, UTC+2)
  assert.equal(createRoundNight(new Date("2026-10-14T19:00:00Z")), "2026-10-14");
  // 01:30 and 05:59 the next morning
  assert.equal(createRoundNight(new Date("2026-10-14T23:30:00Z")), "2026-10-14");
  assert.equal(createRoundNight(new Date("2026-10-15T03:59:00Z")), "2026-10-14");
  // 06:00
  assert.equal(createRoundNight(new Date("2026-10-15T04:00:00Z")), "2026-10-15");
  // winter time (UTC+1): 05:30 is still the night before, 06:30 is the new day
  assert.equal(createRoundNight(new Date("2026-12-02T04:30:00Z")), "2026-12-01");
  assert.equal(createRoundNight(new Date("2026-12-02T05:30:00Z")), "2026-12-02");
});

test("before any change the active teams play", () => {
  assert.deepEqual(teams.map((t) => isPlaying(t, null)), [true, true, false]);
});

test("the first change takes who sits out now, plus the team switched", () => {
  assert.deepEqual(switchTeams(teams, null, [2], false), [2, 3]);
  // switching on an inactive team: nobody sits out
  assert.deepEqual(switchTeams(teams, null, [3], true), []);
  // a change elsewhere (rounds, window, smoking) takes who sits out as it is
  assert.deepEqual(switchTeams(teams, null, [], true), [3]);
});

test("after that a team's active switch doesn't move it", () => {
  const sittingOut = new Set(switchTeams(teams, null, [], true));
  // team 1 made inactive on Ekipe keeps playing, team 3 made active stays out
  const later = [
    {id: 1, active: false},
    {id: 2, active: true},
    {id: 3, active: true},
  ];
  assert.deepEqual(later.map((t) => isPlaying(t, sittingOut)), [true, true, false]);
  // until it is switched on here
  assert.deepEqual(switchTeams(later, sittingOut, [3], true), []);
});

test("a team added to the league later plays", () => {
  const sittingOut = new Set([3]);
  assert.equal(isPlaying({id: 4, active: true}, sittingOut), true);
});

test("a team taken out of the league is dropped, so it plays when added back", () => {
  const sittingOut = new Set([2, 3]);
  const withoutTwo = teams.filter((t) => t.id !== 2);
  const next = switchTeams(withoutTwo, sittingOut, [1], false);
  assert.deepEqual(next, [1, 3]);
  assert.equal(isPlaying({id: 2, active: true}, new Set(next)), true);
});

test("switching several teams at once (Označi sve)", () => {
  assert.deepEqual(switchTeams(teams, new Set([3]), [1, 2], false), [1, 2, 3]);
  assert.deepEqual(switchTeams(teams, new Set([1, 2, 3]), [1, 2], true), [3]);
});

test("a draft the server refuses", () => {
  const ok = {rounds: 4, window_size: 8, smoking_on: true, smoking_tables: [1, 2], sitting_out: [3]};
  assert.equal(CreateRoundDraftValidation.safeParse(ok).success, true);
  assert.equal(CreateRoundDraftValidation.safeParse({...ok, rounds: 0}).success, false);
  assert.equal(CreateRoundDraftValidation.safeParse({...ok, rounds: 6}).success, false);
  assert.equal(CreateRoundDraftValidation.safeParse({...ok, window_size: 7}).success, false);
  assert.equal(CreateRoundDraftValidation.safeParse({...ok, window_size: 202}).success, false);
  assert.equal(CreateRoundDraftValidation.safeParse({...ok, smoking_tables: [0]}).success, false);
  assert.equal(CreateRoundDraftValidation.safeParse({...ok, sitting_out: [1.5]}).success, false);
  assert.equal(CreateRoundDraftValidation.safeParse({...ok, sitting_out: undefined}).success, false);
});
