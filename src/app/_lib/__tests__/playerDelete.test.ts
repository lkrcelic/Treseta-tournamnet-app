import assert from "node:assert/strict";
import {test} from "node:test";
import {z} from "zod";
import {adminPlayerRows, anonymisedPlayerData} from "../players/admin";
import {displayName} from "../players/names";
import {usernameError} from "../validation/username";
import {FreezeRound, lineupFreezeRows, ratedPlayerIds} from "../lineup";
import {BYE_TEAM_ID} from "../bye";

// Handoff §6 "Obriši igrača": the player is removed from all teams and can't log in; played rounds stay in the
// standings and the name becomes "Obrisani igrač". Nobody else's rating may change.

const now = new Date("2026-10-12T18:30:00.000Z");

test("a deleted player is shown as Obrisani igrač", () => {
  assert.equal(displayName(anonymisedPlayerData(42, now)), "Obrisani igrač");
});

test("the anonymised username follows the username rules and is different for every player", () => {
  const ids = [1, 7, 42, 999, 123456, 2_147_483_647];
  const usernames = ids.map((id) => anonymisedPlayerData(id, now).username);
  for (const u of usernames) assert.equal(usernameError(u), undefined, u);
  assert.equal(new Set(usernames).size, ids.length);
  assert.equal(anonymisedPlayerData(42, now).username, "obrisani_42");
  // when someone already has the plain one, the next try is another valid, unused name
  const retry = anonymisedPlayerData(42, now, 2).username;
  assert.equal(usernameError(retry), undefined);
  assert.notEqual(retry, "obrisani_42");
  assert.notEqual(retry, anonymisedPlayerData(422, now).username);
});

test("the anonymised email is a valid address, unique per player, that never receives mail", () => {
  const emails = [1, 2, 12, 21, 2_147_483_647].map((id) => anonymisedPlayerData(id, now).email);
  assert.equal(new Set(emails).size, emails.length);
  for (const e of emails) {
    assert.equal(z.string().email().safeParse(e).success, true, e);
    assert.ok(e.endsWith("@deleted.invalid"), e);
  }
  assert.notEqual(anonymisedPlayerData(1, now, 2).email, anonymisedPlayerData(1, now).email);
});

test("nothing personal is left and nobody can log in", () => {
  const data = anonymisedPlayerData(42, now);
  assert.equal(data.password_hash, "");
  for (const key of ["phone", "birth_date", "image", "name", "emailVerified"] as const) assert.equal(data[key], null, key);
  assert.equal(data.smoker, false);
  assert.equal(data.smoker_answered, true);
  assert.equal(data.player_role, "PLAYER");
  // deleted ⇒ inactive (the Player_deleted_inactive_check constraint)
  assert.equal(data.active, false);
  assert.equal(data.deleted_at, now);
  // the old values are all replaced: no field keeps anything from the player
  assert.deepEqual(Object.keys(data).sort(), [
    "active", "birth_date", "deleted_at", "email", "emailVerified", "first_name", "image", "last_name", "name",
    "password_hash", "phone", "player_role", "smoker", "smoker_answered", "username",
  ]);
});

test("the rating stays: the update doesn't touch it", () => {
  const data = anonymisedPlayerData(42, now);
  for (const key of ["rating", "rating_deviation", "volatility"]) assert.equal(key in data, false, key);
});

// --- Freezing lineups before a roster changes ----------------------------------------------------------------------

const round = (id: number, team1_id: number, team2_id: number, lineup: FreezeRound["lineup"] = [], open = false): FreezeRound => ({
  id,
  open,
  team1_id,
  team2_id,
  lineup,
});

test("a finished round without a lineup gets the team's roster of today", () => {
  const rows = lineupFreezeRows([round(1, 10, 20)], new Map([[10, [1, 2, 3]]]));
  assert.deepEqual(rows, [
    {round_id: 1, player_id: 1, team_id: 10},
    {round_id: 1, player_id: 2, team_id: 10},
    {round_id: 1, player_id: 3, team_id: 10},
  ]);
});

test("only the teams whose roster changes are saved, on either side of the table", () => {
  const rows = lineupFreezeRows([round(1, 10, 20), round(2, 30, 10), round(3, 30, 20)], new Map([[10, [1, 2]]]));
  assert.deepEqual(rows.map((r) => [r.round_id, r.team_id]), [[1, 10], [1, 10], [2, 10], [2, 10]]);
});

test("a round that already has a lineup for the team keeps it", () => {
  const picked = [{player_id: 2, team_id: 10}, {player_id: 3, team_id: 10}];
  assert.deepEqual(lineupFreezeRows([round(1, 10, 20, picked)], new Map([[10, [1, 2, 3]]])), []);
  // the other team's lineup doesn't count as this team's
  const theirs = [{player_id: 7, team_id: 20}, {player_id: 8, team_id: 20}];
  assert.equal(lineupFreezeRows([round(2, 10, 20, theirs)], new Map([[10, [1, 2]]])).length, 2);
});

test("bye rounds and open rounds are left alone", () => {
  const rosters = new Map([[10, [1, 2]]]);
  assert.deepEqual(lineupFreezeRows([round(1, 10, BYE_TEAM_ID), round(2, BYE_TEAM_ID, 10)], rosters), []);
  assert.deepEqual(lineupFreezeRows([round(3, 10, 20, [], true)], rosters), []);
});

test("a player on both teams' rosters stays on both sides, as the round was rated", () => {
  const both = new Map([[10, [1, 5]], [20, [5, 6]]]);
  const rows = lineupFreezeRows([round(1, 10, 20)], both);
  assert.deepEqual(rows, [
    {round_id: 1, player_id: 1, team_id: 10},
    {round_id: 1, player_id: 5, team_id: 10},
    {round_id: 1, player_id: 5, team_id: 20},
    {round_id: 1, player_id: 6, team_id: 20},
  ]);
  assert.deepEqual(ratedPlayerIds(rows, 10, []), [1, 5]);
  assert.deepEqual(ratedPlayerIds(rows, 20, []), [5, 6]);
  // the same when the two teams are saved one after the other (two roster changes)
  const first = lineupFreezeRows([round(1, 10, 20)], new Map([[10, [1, 5]]]));
  const second = lineupFreezeRows([round(1, 10, 20, first)], new Map([[20, [5, 6]]]));
  assert.deepEqual([...first, ...second], rows);
});

test("after the freeze the round is rated with the same players, whatever the roster becomes", () => {
  const before = [1, 2, 3];
  const rows = lineupFreezeRows([round(1, 10, 20)], new Map([[10, before]]));
  // player 2 leaves, player 9 joins
  const after = [1, 3, 9];
  assert.deepEqual(ratedPlayerIds(rows, 10, after), ratedPlayerIds([], 10, before));
  // the other team is still rated with its roster, as before
  assert.deepEqual(ratedPlayerIds(rows, 20, [7, 8]), [7, 8]);
});

// --- The admin directory ------------------------------------------------------------------------------------------

test("the directory is in Croatian name order, teams too, nameless players under Igrač bez imena", () => {
  const p = (id: number, first_name: string, last_name: string, teams: string[] = []) => ({
    id,
    first_name,
    last_name,
    username: `u${id}`,
    active: true,
    teams: teams.map((team_name, i) => ({team_id: id * 10 + i, team_name})),
  });
  const rows = adminPlayerRows([p(1, "Zoran", "Z"), p(2, "Čedo", "Č", ["Šišmiši", "Asovi", "Čvorci"]), p(3, "Cvita", "C"), p(4, "", "")]);
  assert.deepEqual(rows.map((r) => r.name), ["Cvita C", "Čedo Č", "Igrač bez imena", "Zoran Z"]);
  assert.deepEqual(rows[1].teams.map((t) => t.team_name), ["Asovi", "Čvorci", "Šišmiši"]);
});
