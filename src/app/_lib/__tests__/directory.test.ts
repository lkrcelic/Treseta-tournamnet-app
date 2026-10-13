import assert from "node:assert/strict";
import {test} from "node:test";
import type {AdminPlayerRow} from "../../_interfaces/player";
import {TEAM_NAME_REQUIRED, TEAM_NAME_TAKEN} from "../../_interfaces/team";
import {
  addPlayerTeam,
  addTeamLeague,
  addTeamMember,
  directoryPage,
  directoryPages,
  filterPlayers,
  filterTeams,
  leagueAddOptions,
  leagueOptionSub,
  playerAddOptions,
  playerDirectorySub,
  removePlayerTeam,
  removeTeamMember,
  renamePlayersTeam,
  renameTeamIn,
  sortHr,
  teamDirectorySub,
  teamNameError,
  toDirectoryTeam,
} from "../ui/directory";

const teams = [
  toDirectoryTeam({
    team_id: 1,
    team_name: "Dalmatinci",
    teamPlayers: [
      {player: {id: 10, username: "ivo.k", first_name: "Ivo", last_name: "Kovač"}},
      {player: {id: 11, username: "srecko", first_name: "Srećko", last_name: "Jurić"}},
      {player: {id: 12, username: "branko", first_name: "Branko", last_name: "Horvat"}},
    ],
    leagueTeams: [{league: {league_id: 2, league_name: "Zimska liga"}}],
  }),
  toDirectoryTeam({team_id: 2, team_name: "Zagorci", teamPlayers: []}),
];

const row = (id: number, name: string, username: string, teams: {team_id: number; team_name: string}[] = [], active = true): AdminPlayerRow => {
  const [first_name, last_name] = name.split(" ");
  return {id, first_name, last_name, name, username, teams, active};
};

const players = [
  row(10, "Ivo Kovač", "ivo.k", [{team_id: 1, team_name: "Dalmatinci"}]),
  row(20, "Đuro Šimić", "djuro"),
  row(21, "Ana Čolić", "ana.c", [], false),
];

test("api teams become directory rows with players and leagues", () => {
  assert.deepEqual(teams[0].leagues, [{id: 2, name: "Zimska liga"}]);
  assert.deepEqual(teams[1].players, []);
  assert.deepEqual(teams[1].leagues, []);
  assert.equal(teamDirectorySub(teams[0]), "3 igrača · 1 liga");
  assert.equal(teamDirectorySub(teams[1]), "0 igrača · 0 liga");
});

test("the team directory searches team names, players' names and usernames, without diacritics", () => {
  assert.deepEqual(filterTeams(teams, "zag").map((t) => t.id), [2]);
  assert.deepEqual(filterTeams(teams, "srecko").map((t) => t.id), [1]);
  assert.deepEqual(filterTeams(teams, "juric").map((t) => t.id), [1]);
  assert.deepEqual(filterTeams(teams, "KOVAČ").map((t) => t.id), [1]);
  assert.equal(filterTeams(teams, "").length, 2);
  assert.equal(filterTeams(teams, "nitko").length, 0);
});

test("the player directory searches names and usernames", () => {
  assert.deepEqual(filterPlayers(players, "djuro").map((p) => p.id), [20]);
  assert.deepEqual(filterPlayers(players, "duro").map((p) => p.id), [20]);
  assert.deepEqual(filterPlayers(players, "colic").map((p) => p.id), [21]);
  assert.deepEqual(filterPlayers(players, "ivo.k").map((p) => p.id), [10]);
  assert.equal(filterPlayers(players, " ").length, 3);
});

test("a player's directory line: @username and every team", () => {
  assert.equal(playerDirectorySub(players[0]), "@ivo.k · Dalmatinci");
  assert.equal(playerDirectorySub(players[1]), "@djuro");
  assert.equal(
    playerDirectorySub(row(1, "A B", "ab", [{team_id: 1, team_name: "Istrani"}, {team_id: 2, team_name: "Puleni"}])),
    "@ab · Istrani, Puleni"
  );
});

test("Croatian alphabetical order", () => {
  assert.deepEqual(
    sortHr(["Zagorci", "Čakovčani", "Cetinjani", "Đakovčani", "Dalmatinci", "Šibenčani", "Slavonci"], (s) => s),
    ["Cetinjani", "Čakovčani", "Dalmatinci", "Đakovčani", "Slavonci", "Šibenčani", "Zagorci"]
  );
});

test("the directory shows 12 rows a page", () => {
  const list = Array.from({length: 30}, (_, i) => i);
  assert.deepEqual(directoryPage(list, 1), {shown: list.slice(0, 12), left: 18});
  assert.deepEqual(directoryPage(list, 2), {shown: list.slice(0, 24), left: 6});
  assert.deepEqual(directoryPage(list, 3), {shown: list, left: 0});
  assert.deepEqual(directoryPage([], 1), {shown: [], left: 0});
});

test("a selected row past the pages shown brings its page and at least half the next", () => {
  // nothing selected, or among the pages asked for: those pages
  assert.equal(directoryPages(1, -1), 1);
  assert.equal(directoryPages(2, 3), 2);
  assert.equal(directoryPages(1, 11), 1);
  // the 13th row: two pages (11 rows after it); the 77th: seven pages (84 rows, 7 after it)
  assert.equal(directoryPages(1, 12), 2);
  assert.equal(directoryPages(1, 17), 2);
  assert.equal(directoryPages(1, 18), 3);
  assert.equal(directoryPages(1, 76), 7);
  const list = Array.from({length: 100}, (_, i) => i);
  const {shown, left} = directoryPage(list, directoryPages(1, 76));
  assert.equal(shown.length - 77, 7);
  assert.equal(left, 16);
});

test("Dodaj igrača offers the active players who aren't in the team, found by name or username", () => {
  const options = playerAddOptions(players, [10]);
  assert.deepEqual(options, [{id: 20, name: "Đuro Šimić", sub: "@djuro", search: "Đuro Šimić djuro"}]);
});

test("Dodaj u ligu offers the other leagues, running ones first, with the season and U tijeku", () => {
  const today = "2026-10-13";
  const leagues = [
    {id: 1, name: "Zimska liga", season: "Zima 2026", endDate: "2026-03-01"},
    {id: 2, name: "Piatnik Bela Liga 2026", season: "2026", endDate: null, lastNight: "2026-12-16"},
    {id: 3, name: "Kup Piatnik", season: null, endDate: null},
    {id: 4, name: "Stara liga", season: null, endDate: "2020-01-01"},
  ];
  assert.equal(leagueOptionSub(leagues[0], today), "Zima 2026");
  assert.equal(leagueOptionSub(leagues[1], today), "Sezona 2026 · U tijeku");
  assert.equal(leagueOptionSub(leagues[2], today), "U tijeku");
  assert.equal(leagueOptionSub(leagues[3], today), undefined);
  assert.deepEqual(
    leagueAddOptions(leagues, [2], today).map((o) => o.id),
    [3, 4, 1]
  );
});

test("a change on a Team page shows in both directories", () => {
  const renamed = renameTeamIn(teams, 2, "Zagorci 2");
  assert.equal(renamed[1].name, "Zagorci 2");
  assert.equal(renamed[0], teams[0]);

  const added = addTeamMember(teams, 2, {id: 20, first_name: "Đuro", last_name: "Šimić", username: "djuro"});
  assert.equal(teamDirectorySub(added[1]), "1 igrač · 0 liga");
  assert.equal(addTeamMember(added, 2, {id: 20, first_name: "Đuro", last_name: "Šimić"})[1].players.length, 1);
  assert.equal(teamDirectorySub(removeTeamMember(added, 2, 20)[1]), "0 igrača · 0 liga");

  const joined = addTeamLeague(teams, 2, {id: 5, name: "Kup"});
  assert.equal(teamDirectorySub(joined[1]), "0 igrača · 1 liga");
  assert.equal(addTeamLeague(joined, 2, {id: 5, name: "Kup"})[1].leagues.length, 1);

  const inTeam = addPlayerTeam(players, 20, {team_id: 2, team_name: "Zagorci"});
  assert.equal(playerDirectorySub(inTeam[1]), "@djuro · Zagorci");
  const inTwo = addPlayerTeam(inTeam, 20, {team_id: 1, team_name: "Dalmatinci"});
  assert.equal(playerDirectorySub(inTwo[1]), "@djuro · Dalmatinci, Zagorci");
  assert.equal(playerDirectorySub(removePlayerTeam(inTwo, 20, 1)[1]), "@djuro · Zagorci");
  assert.equal(playerDirectorySub(renamePlayersTeam(inTwo, 1, "Splićani")[1]), "@djuro · Splićani, Zagorci");
  assert.equal(renamePlayersTeam(inTwo, 1, "Splićani")[2], inTwo[2]);
});

test("a team's name: required, and not another team's name ignoring case", () => {
  assert.equal(teamNameError("  ", teams, null), TEAM_NAME_REQUIRED);
  assert.equal(teamNameError("zagorci", teams, 1), TEAM_NAME_TAKEN);
  assert.equal(teamNameError(" Zagorci ", teams, 2), "");
  assert.equal(teamNameError("Purgeri", teams, null), "");
  assert.equal(teamNameError("Purgeri", null, null), "");
});
