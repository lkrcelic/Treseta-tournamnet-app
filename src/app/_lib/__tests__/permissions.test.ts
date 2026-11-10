import assert from "node:assert/strict";
import {test} from "node:test";
import {ALL_CAPABILITIES, Capability, can, canManageAnything, capabilitiesOf} from "../auth/permissions";
import {canManageTournament, ownTournamentFilter} from "../auth/ownership";
import {ROLE_NAME, ROLES, rolesOf} from "../auth/roles";
import {playerView} from "../players/privacy";
import {AdminPlayerUpdateValidation} from "../../_interfaces/player";

const admin = {id: 1, player_role: "ADMIN"};
const organizer = {id: 2, player_role: "ORGANIZER"};
const other = {id: 3, player_role: "ORGANIZER"};
const player = {id: 4, player_role: "PLAYER"};

test("rolesOf is the only reader of player_role, and an unknown role gets nothing", () => {
  assert.deepEqual(rolesOf(admin), ["ADMIN"]);
  assert.deepEqual(rolesOf(organizer), ["ORGANIZER"]);
  assert.deepEqual(rolesOf(player), ["PLAYER"]);
  assert.deepEqual(rolesOf(null), []);
  assert.deepEqual(rolesOf(undefined), []);
  // a role the code doesn't know (an older or newer deployment's enum value) may do nothing, it isn't an error
  assert.deepEqual(rolesOf({player_role: "REFEREE"}), []);
  assert.equal(can({player_role: "REFEREE"}, "tournament.create"), false);
});

test("every role has a name and every name a role", () => {
  assert.deepEqual([...ROLES], ["ADMIN", "ORGANIZER", "PLAYER"]);
  for (const role of ROLES) assert.ok(ROLE_NAME[role].length > 0, role);
});

test("an admin may do everything, a player nothing of the league's", () => {
  assert.deepEqual(capabilitiesOf(admin), [...ALL_CAPABILITIES]);
  assert.deepEqual(capabilitiesOf(player), []);
  assert.deepEqual(capabilitiesOf(null), []);
  assert.equal(canManageAnything(admin), true);
  assert.equal(canManageAnything(player), false);
  assert.equal(canManageAnything(null), false);
});

test("an organizer may make tournaments and run their own, and nothing of the league's", () => {
  // Zabrana prijava stays the admin's: the ban API is league wide, it knows nothing of one tournament
  const may: Capability[] = [
    "tournament.create",
    "tournament.manage.own",
    "team.create",
    "team.edit",
    "player.directory",
    "player.contact",
  ];
  assert.deepEqual(capabilitiesOf(organizer), may);
  // what the role must not grow into by accident: the whole list minus the six above
  for (const cap of ALL_CAPABILITIES) {
    if (!may.includes(cap)) assert.equal(can(organizer, cap), false, cap);
  }
  assert.equal(canManageAnything(organizer), true);
});

test("ownership is its own layer: an organizer runs their tournament, not another's", () => {
  const mine = {created_by: organizer.id};
  const theirs = {created_by: other.id};
  // nobody made the old tournaments: only an admin touches them
  const nobodys = {created_by: null};

  assert.equal(canManageTournament(organizer, mine), true);
  assert.equal(canManageTournament(organizer, theirs), false);
  assert.equal(canManageTournament(organizer, nobodys), false);

  assert.equal(canManageTournament(admin, mine), true);
  assert.equal(canManageTournament(admin, theirs), true);
  assert.equal(canManageTournament(admin, nobodys), true);

  // being a player is not ownership: a player who somehow made a row still may not run it
  assert.equal(canManageTournament(player, {created_by: player.id}), false);
  assert.equal(canManageTournament(null, mine), false);
});

test("an organizer's lists are narrowed to their own tournaments, an admin's are not", () => {
  assert.deepEqual(ownTournamentFilter(organizer), {created_by: organizer.id});
  assert.equal(ownTournamentFilter(admin), null);
  // a player never gets these lists (the capability check refuses first); the filter still gives nothing away
  assert.deepEqual(ownTournamentFilter(player), {created_by: player.id});
});

// --- the three layers on one player's data ------------------------------------------------------

test("a player's data comes in three steps: public, the phone, the private fields", () => {
  const marko = {
    id: 9,
    first_name: "Marko",
    last_name: "Marković",
    active: true,
    username: "mmarkovic",
    email: "marko@example.com",
    phone: "+385 93 958 3406",
    birth_date: "1964-07-23",
    smoker: true,
    player_role: "PLAYER",
  };
  // Bela's #88 (a public username) hasn't come here, so the username is still private
  const PRIVATE = ["username", "email", "birth_date", "smoker"] as const;

  // a player looking at someone else: the name, nothing else
  const asPlayer = playerView(marko, player);
  assert.equal(asPlayer.phone, undefined);
  for (const key of PRIVATE) assert.equal(asPlayer[key], undefined, key);

  // an organizer: the phone, so they can call the teams of their tournament — and nothing further
  const asOrganizer = playerView(marko, organizer);
  assert.equal(asOrganizer.phone, marko.phone);
  for (const key of PRIVATE) assert.equal(asOrganizer[key], undefined, key);

  // an admin, and the player themselves: everything
  for (const viewer of [admin, {id: marko.id, player_role: "PLAYER"}]) {
    const full = playerView(marko, viewer);
    assert.equal(full.phone, marko.phone);
    assert.equal(full.username, marko.username);
    assert.equal(full.email, marko.email);
  }
});

test("the role is public: every logged-in player sees who runs the league and who runs tournaments", () => {
  const row = {id: 9, first_name: "A", last_name: "B", active: true, username: "ab", email: "a@b.c", phone: null, birth_date: null, smoker: false};
  assert.equal(playerView({...row, player_role: "ADMIN"}, player).role, "ADMIN");
  assert.equal(playerView({...row, player_role: "ORGANIZER"}, player).role, "ORGANIZER");
  // a plain player has no label, so the key is left out
  assert.equal("role" in playerView({...row, player_role: "PLAYER"}, player), false);
  // and so has a role this build doesn't know
  assert.equal("role" in playerView({...row, player_role: "SUDAC"}, player), false);
});

test("the roles the role picker offers are the roles the code knows", () => {
  // AdminPlayerUpdateValidation keeps its own tuple (zod needs one): it must not drift from ROLES
  for (const role of ROLES) assert.equal(AdminPlayerUpdateValidation.safeParse({role}).success, true, role);
  assert.equal(AdminPlayerUpdateValidation.safeParse({role: "SUDAC"}).success, false);
});
