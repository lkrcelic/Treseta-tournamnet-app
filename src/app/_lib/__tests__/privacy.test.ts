import assert from "node:assert/strict";
import {test} from "node:test";
import {
  fullAccess,
  lineupVisible,
  PHOTO_MEMBERS_ONLY,
  PHOTO_SELF_ONLY,
  playerPhotoChangeError,
  playerPhotoUrl,
  playerPhotoVisible,
  playerView,
  PrivatePlayer,
  rosterUsername,
  rosterView,
  teamPhotoChangeError,
  teamPhotoUrl,
  teamPhotoVisible,
  Viewer,
} from "../players/privacy";
import {PHOTO_BLOCKED_ERROR, PhotoVisibility} from "../../_interfaces/photo";
import {displayName, NAMELESS_PLAYER} from "../players/names";
import {PlayerPublicResponseValidation, PlayerSelfResponseValidation} from "../../_interfaces/player";
import {isDbId} from "../helpers/query/dbId";

// Handoff §6 "Privacy": another player's page shows a regular user only the name; the player themselves and admins
// get everything. Rating, teams and results are public and aren't part of this filter.

const marko: PrivatePlayer = {
  id: 7,
  first_name: "Marko",
  last_name: "Marković",
  active: true,
  username: "mmarkovic",
  email: "marko@example.com",
  phone: "+385 91 234 5678",
  birth_date: new Date("1990-04-12T00:00:00.000Z"),
  smoker: true,
  player_role: "PLAYER",
};

const other: Viewer = {id: 9, player_role: "PLAYER"};
const admin: Viewer = {id: 1, player_role: "ADMIN"};
const self: Viewer = {id: 7, player_role: "PLAYER"};
const PERSONAL = ["username", "email", "phone", "birth_date", "smoker", "is_admin"];

test("another regular user gets only the name and whether the account is active", () => {
  const view = playerView(marko, other);
  assert.deepEqual(view, {id: 7, first_name: "Marko", last_name: "Marković", name: "Marko Marković", active: true});
  // the personal keys are absent, not null or undefined, so they never reach the JSON
  for (const key of PERSONAL) assert.equal(key in view, false, key);
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(view))).sort(), ["active", "first_name", "id", "last_name", "name"]);
});

test("a logged-out viewer is treated like another user", () => {
  assert.deepEqual(Object.keys(playerView(marko, null)).sort(), ["active", "first_name", "id", "last_name", "name"]);
  assert.equal(fullAccess(null, 7), false);
});

test("the player themselves and admins get every field", () => {
  const full = {
    id: 7,
    first_name: "Marko",
    last_name: "Marković",
    name: "Marko Marković",
    active: true,
    username: "mmarkovic",
    email: "marko@example.com",
    phone: "+385 91 234 5678",
    birth_date: "1990-04-12",
    smoker: true,
    is_admin: false,
  };
  assert.deepEqual(playerView(marko, self), full);
  assert.deepEqual(playerView(marko, admin), full);
  assert.equal(playerView({...marko, player_role: "ADMIN"}, self).is_admin, true);
});

test("missing personal data stays null for the ones who may see it", () => {
  const google = {...marko, phone: null, birth_date: null, smoker: false};
  const view = playerView(google, admin);
  assert.equal(view.phone, null);
  assert.equal(view.birth_date, null);
  assert.equal(view.smoker, false);
  assert.ok("phone" in view && "birth_date" in view);
  // and for anyone else it is still absent
  assert.equal("phone" in playerView(google, other), false);
});

test("a deactivated player shows as inactive to everyone", () => {
  assert.equal(playerView({...marko, active: false}, other).active, false);
  assert.equal(playerView({...marko, active: false}, admin).active, false);
});

test("a birth date already given as YYYY-MM-DD is kept", () => {
  assert.equal(playerView({...marko, birth_date: "1990-04-12"}, self).birth_date, "1990-04-12");
});

test("a team roster shows the username only to an admin and to the player themselves", () => {
  assert.equal(rosterUsername(other, 7, "mmarkovic"), null);
  assert.equal(rosterUsername(null, 7, "mmarkovic"), null);
  assert.equal(rosterUsername(self, 7, "mmarkovic"), "mmarkovic");
  assert.equal(rosterUsername(admin, 7, "mmarkovic"), "mmarkovic");
  // the viewer's own username on someone else's row stays hidden
  assert.equal(rosterUsername(self, 8, "ivanb"), null);
});

test("GET /api/players/[id] gives another user only the name and whether the account is active", () => {
  // the route answers others with PlayerPublicResponseValidation.parse(<the full row the player themselves gets>)
  const row = PlayerSelfResponseValidation.parse({
    ...marko,
    player_role: "ADMIN",
    rating: 1532,
    password_hash: "x",
    birth_date: new Date("1990-04-12T00:00:00.000Z"),
  });
  const shown = PlayerPublicResponseValidation.parse(row);
  assert.deepEqual(Object.keys(shown).sort(), ["active", "first_name", "id", "last_name"]);
  assert.deepEqual(shown, {id: 7, first_name: "Marko", last_name: "Marković", active: true});
});

test("a team roster: usernames for admins and the player themselves, in Croatian name order", () => {
  const roster = [
    {id: 1, first_name: "Željko", last_name: "Ban", username: "zban"},
    {id: 2, first_name: "petar", last_name: "Novak", username: "pnovak"},
    {id: 3, first_name: "Tomy", last_name: "Lee", username: "tlee"},
    {id: 4, first_name: "Čedo", last_name: "Car", username: "ccar"},
    {id: 7, first_name: "Ana", last_name: "Zec", username: "azec"},
  ];
  const names = (r: {first_name: string}[]) => r.map((p) => p.first_name);
  // the database's C collation would give Tomy, petar, Čedo, Željko (capitals first, Č and Ž after Z)
  assert.deepEqual(names(rosterView(other, roster)), ["Ana", "Čedo", "petar", "Tomy", "Željko"]);

  // another player: no usernames at all (the key is left out)
  for (const p of rosterView(other, roster)) assert.equal("username" in p, false);
  // the player themselves: only their own
  assert.deepEqual(rosterView(self, roster).filter((p) => "username" in p), [{id: 7, first_name: "Ana", last_name: "Zec", username: "azec"}]);
  // an admin: everyone's
  assert.deepEqual(rosterView(admin, roster).map((p) => p.username), ["azec", "ccar", "pnovak", "tlee", "zban"]);
});

test("a round's lineup (both teams' usernames) is for its players while it is open, a finished one for admins only", () => {
  // the route lets only the players of the round (or an admin) this far: canPlayRound
  assert.equal(lineupVisible(other, {open: true}), true);
  assert.equal(lineupVisible(admin, {open: true}), true);
  // a finished round: a player of it gets "Ova runda je već završena." (403) instead of the rosters
  assert.equal(lineupVisible(other, {open: false}), false);
  assert.equal(lineupVisible(self, {open: false}), false);
  assert.equal(lineupVisible(admin, {open: false}), true);
});

test("a player without a name shows as Igrač bez imena, never as the username", () => {
  assert.equal(displayName({first_name: "", last_name: ""}), NAMELESS_PLAYER);
  assert.equal(displayName({first_name: " ", last_name: ""}), NAMELESS_PLAYER);
  assert.equal(displayName({first_name: "Ivo", last_name: ""}), "Ivo");
  assert.equal(displayName({first_name: "Ivo", last_name: "Ivić"}), "Ivo Ivić");
});

test("an id from a URL must fit the database's integer", () => {
  assert.equal(isDbId(1), true);
  assert.equal(isDbId(2_147_483_647), true);
  for (const id of [0, -1, 1.5, NaN, Infinity, 2_147_483_648]) assert.equal(isDbId(id), false, String(id));
});

// ---------- profile photos (Claude Design "Profilna slika igrača i ekipe") ----------

// Marko (7) shares a team with the viewer 9 ("other" is his teammate here); 12 shares no team with him
const stranger: Viewer = {id: 12, player_role: "PLAYER"};
const matesOfOther = new Set([9, 7]);
const matesOfStranger = new Set([12, 30]);
const owner = (photo_visibility: PhotoVisibility) => ({id: 7, photo_visibility});

test("who sees a player's photo: all nine choices × self / teammate / anyone else", () => {
  const cases: [PhotoVisibility, Viewer, ReadonlySet<number>, boolean][] = [
    ["ALL", self, new Set(), true],
    ["ALL", other, matesOfOther, true],
    ["ALL", stranger, matesOfStranger, true],
    ["TEAMMATES", self, new Set(), true],
    ["TEAMMATES", other, matesOfOther, true],
    ["TEAMMATES", stranger, matesOfStranger, false],
    ["ME", self, new Set(), true],
    ["ME", other, matesOfOther, false],
    ["ME", stranger, matesOfStranger, false],
  ];
  for (const [visibility, viewer, mates, seen] of cases) {
    assert.equal(playerPhotoVisible(viewer, owner(visibility), mates), seen, `${visibility} for ${viewer.id}`);
  }
});

test("an admin sees every photo; nobody logged out sees any", () => {
  for (const v of ["ALL", "TEAMMATES", "ME"] as const) {
    assert.equal(playerPhotoVisible(admin, owner(v), new Set()), true, v);
    assert.equal(playerPhotoVisible(null, owner(v), new Set([7])), false, v);
    assert.equal(teamPhotoVisible(admin, {photo_visibility: v}, new Set(), 5), true, v);
    assert.equal(teamPhotoVisible(null, {photo_visibility: v}, new Set([5]), 5), false, v);
  }
});

test("who sees a team's photo: everyone, or only its players", () => {
  assert.equal(teamPhotoVisible(stranger, {photo_visibility: "ALL"}, new Set(), 5), true);
  assert.equal(teamPhotoVisible(other, {photo_visibility: "TEAMMATES"}, new Set([5, 8]), 5), true);
  assert.equal(teamPhotoVisible(stranger, {photo_visibility: "TEAMMATES"}, new Set([8]), 5), false);
});

test("a list gives the photo's address only to whoever may see it, with its version", () => {
  const at = new Date("2026-10-18T20:00:00.000Z");
  const marko = {id: 7, photo_visibility: "ME" as const, photo_updated_at: at};
  assert.equal(playerPhotoUrl(marko, self, new Set()), `/api/players/7/photo?v=${at.getTime()}`);
  assert.equal(playerPhotoUrl(marko, admin, new Set()), `/api/players/7/photo?v=${at.getTime()}`);
  // hidden: no address at all, so the page shows the initials and the photo's address is never handed out
  assert.equal(playerPhotoUrl(marko, other, matesOfOther), null);
  // no photo
  assert.equal(playerPhotoUrl({...marko, photo_visibility: "ALL", photo_updated_at: null}, other, matesOfOther), null);

  const team = {team_id: 5, photo_visibility: "TEAMMATES" as const, photo_updated_at: at};
  assert.equal(teamPhotoUrl(team, other, new Set([5])), `/api/teams/5/photo?v=${at.getTime()}`);
  assert.equal(teamPhotoUrl(team, stranger, new Set([8])), null);
  // a new photo is a new address, so the old one never comes from the cache
  assert.notEqual(playerPhotoUrl({...marko, photo_updated_at: new Date(at.getTime() + 1)}, self, new Set()), playerPhotoUrl(marko, self, new Set()));
});

test("only the player sets their photo (403 for another player and for an admin), and not while it is blocked", () => {
  const open = {id: 7, photo_blocked: false};
  const blocked = {id: 7, photo_blocked: true};
  assert.equal(playerPhotoChangeError(self, open, "set"), null);
  assert.equal(playerPhotoChangeError(other, open, "set"), PHOTO_SELF_ONLY);
  assert.equal(playerPhotoChangeError(admin, open, "set"), PHOTO_SELF_ONLY);
  assert.equal(playerPhotoChangeError(self, blocked, "set"), PHOTO_BLOCKED_ERROR);
});

test("the player or an admin removes a player's photo, even a blocked one; nobody else", () => {
  const blocked = {id: 7, photo_blocked: true};
  assert.equal(playerPhotoChangeError(self, blocked, "remove"), null);
  assert.equal(playerPhotoChangeError(admin, blocked, "remove"), null);
  assert.equal(playerPhotoChangeError(other, blocked, "remove"), PHOTO_SELF_ONLY);
});

test("any player of a team sets and removes its photo; an admin only removes it", () => {
  const open = {photo_blocked: false};
  assert.equal(teamPhotoChangeError(other, open, true, "set"), null);
  assert.equal(teamPhotoChangeError(stranger, open, false, "set"), PHOTO_MEMBERS_ONLY);
  assert.equal(teamPhotoChangeError(admin, open, false, "set"), PHOTO_MEMBERS_ONLY);
  assert.equal(teamPhotoChangeError(other, {photo_blocked: true}, true, "set"), PHOTO_BLOCKED_ERROR);
  assert.equal(teamPhotoChangeError(other, open, true, "remove"), null);
  assert.equal(teamPhotoChangeError(admin, {photo_blocked: true}, false, "remove"), null);
  assert.equal(teamPhotoChangeError(stranger, open, false, "remove"), PHOTO_MEMBERS_ONLY);
});
