import assert from "node:assert/strict";
import {test} from "node:test";
import {filterTeams, nameActions, playerCount, playerRole, teamNameError, teamSubtitle, toMTTeam} from "../ui/manageTeam";

const teams = [
  toMTTeam({
    team_id: 1,
    team_name: "Dalmatinci",
    founder_id1: 10,
    founder_id2: 11,
    teamPlayers: [
      {player: {id: 10, username: "ivo.k", first_name: "Ivo", last_name: "Kovač"}},
      {player: {id: 11, username: "srecko", first_name: "Srećko", last_name: "Jurić"}},
      {player: {id: 12, username: "branko", first_name: "Branko", last_name: "Horvat"}},
    ],
    leagueTeams: [{active: false, league: {league_id: 2, league_name: "Zimska liga"}}],
  }),
  toMTTeam({team_id: 2, team_name: "Zagorci", teamPlayers: []}),
];

test("api teams become Manage Teams rows with founders and leagues", () => {
  assert.deepEqual(teams[0].founders, [10, 11]);
  assert.deepEqual(teams[0].leagues, [{id: 2, name: "Zimska liga", active: false}]);
  assert.deepEqual(teams[1].founders, []);
  assert.deepEqual(teams[1].leagues, []);
  assert.equal(teamSubtitle(teams[0]), "ivo.k · srecko · branko");
  assert.equal(teamSubtitle(teams[1]), "No players yet");
});

test("the team list searches team names, usernames and full names", () => {
  assert.deepEqual(filterTeams(teams, "zag").map((t) => t.id), [2]);
  assert.deepEqual(filterTeams(teams, "srecko").map((t) => t.id), [1]);
  assert.deepEqual(filterTeams(teams, "juric").map((t) => t.id), [1]);
  assert.equal(filterTeams(teams, "").length, 2);
});

test("founders and teammates, player counts", () => {
  assert.equal(playerRole(teams[0], 10), "Founder");
  assert.equal(playerRole(teams[0], 12), "Teammate");
  assert.equal(playerCount(1), "1 player");
  assert.equal(playerCount(3), "3 players");
});

test("team name errors: required once touched, unique ignoring case", () => {
  assert.equal(teamNameError(null, teams, null), "");
  assert.equal(teamNameError("  ", teams, null), "Team name is required.");
  assert.equal(teamNameError("", teams, 1), "Team name is required.");
  assert.equal(teamNameError("zagorci", teams, 1), "A team with this name already exists.");
  assert.equal(teamNameError("Dalmatinci", teams, 1), "");
  assert.equal(teamNameError("Purgeri", teams, null), "");
});

test("name card buttons", () => {
  assert.deepEqual(nameActions(null, "Dalmatinci", ""), {dirty: false, canSave: false, canCancel: false, saveLabel: "Saved"});
  assert.deepEqual(nameActions("Dalmatinci 2", "Dalmatinci", ""), {dirty: true, canSave: true, canCancel: true, saveLabel: "Save name"});
  assert.equal(nameActions("Zagorci", "Dalmatinci", "A team with this name already exists.").canSave, false);
  assert.deepEqual(nameActions(null, null, ""), {dirty: false, canSave: false, canCancel: true, saveLabel: "Create team"});
  assert.equal(nameActions("Purgeri", null, "").canSave, true);
});
