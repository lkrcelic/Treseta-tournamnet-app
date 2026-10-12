import assert from "node:assert/strict";
import {test} from "node:test";
import {
  aggregateTeamNights,
  bestRank,
  inRatingOrder,
  leagueStatusLine,
  nightParts,
  personalRows,
  playerTeamLeagues,
  playerTiles,
  rosterSubline,
  TeamLeagueFacts,
  TeamNightRound,
  teamInitial,
  teamLeagueRows,
  teamSubline,
  teamTiles,
} from "../ui/profiles";
import {leagueEnded} from "../league";
import {ratingSummary} from "../ui/ratings";
import {RatingRow} from "../../_interfaces/ratings";

// The Team and Player pages (handoff §6): the numbers the overview APIs build and the short texts the pages show

const PULENI = 29;

function round(date: string, league: number, team1: number, team2: number, wins: [number, number], scores: [number, number][] = []): TeamNightRound {
  return {date, league_id: league, league_name: `Liga ${league}`, team1_id: team1, team2_id: team2, team1_wins: wins[0], team2_wins: wins[1], scores};
}

test("a night adds up the team's rounds from its own side, whichever side it sat on", () => {
  const nights = aggregateTeamNights(
    [
      round("2026-03-04", 2, PULENI, 40, [2, 0], [[1001, 650], [1001, 720]]),
      round("2026-03-04", 2, 41, PULENI, [2, 1], [[1001, 900], [700, 1001], [1001, 400]]),
      round("2026-03-04", 2, PULENI, 42, [1, 1], [[1001, 980]]),
    ],
    PULENI
  );
  assert.deepEqual(nights, [
    // +351 +281 (as team 1), −101 +301 −601 (as team 2), +21
    {date: "2026-03-04", league_id: 2, league_name: "Liga 2", wins: 1, draws: 1, losses: 1, diff: 351 + 281 - 101 + 301 - 601 + 21},
  ]);
});

test("a round against the bye team counts like the standings count it, and other teams' rounds are ignored", () => {
  const [night] = aggregateTeamNights([round("2025-11-05", 1, 0, PULENI, [0, 2], [[0, 301], [0, 301]]), round("2025-11-05", 1, 40, 41, [2, 0])], PULENI);
  assert.deepEqual(night, {date: "2025-11-05", league_id: 1, league_name: "Liga 1", wins: 1, draws: 0, losses: 0, diff: 602});
});

test("nights are per night and league, newest first, at most four", () => {
  const nights = aggregateTeamNights(
    [
      round("2025-10-15", 1, PULENI, 40, [2, 0]),
      round("2026-04-15", 1, PULENI, 40, [0, 2]),
      round("2026-04-15", 2, PULENI, 41, [2, 0]),
      round("2026-02-11", 2, PULENI, 41, [2, 0]),
      round("2026-03-04", 2, PULENI, 41, [2, 0]),
    ],
    PULENI
  );
  assert.deepEqual(
    nights.map((n) => `${n.date}/${n.league_id}`),
    ["2026-04-15/2", "2026-04-15/1", "2026-03-04/2", "2026-02-11/2"]
  );
  assert.deepEqual(aggregateTeamNights([], PULENI), []);
});

test("a league is over after its end date, or without one after its last night; tonight still runs", () => {
  assert.equal(leagueEnded("2026-06-30", null, "2026-07-01"), true);
  assert.equal(leagueEnded("2026-06-30", null, "2026-06-30"), false);
  // the end date decides even when the planned nights are over
  assert.equal(leagueEnded("2026-12-31", "2026-04-15", "2026-10-12"), false);
  assert.equal(leagueEnded(null, "2026-04-15", "2026-10-12"), true);
  assert.equal(leagueEnded(null, "2026-10-12", "2026-10-12"), false);
  // nothing planned yet: still running
  assert.equal(leagueEnded(null, null, "2026-10-12"), false);
});

const standings = (...rows: [team: number, played: number, score: number][]) => rows.map(([team_id, rounds_played, score]) => ({team_id, rounds_played, score}));

function league(id: number, rows: TeamLeagueFacts["standings"], end: string | null = null, last: string | null = null): TeamLeagueFacts {
  return {league_id: id, league_name: `Liga ${id}`, season: `${2024 + id}`, end_date: end, last_night: last, standings: rows};
}

test("a league row has the team's place in Ukupni poredak and its points; none before it has played there", () => {
  const rows = teamLeagueRows(
    [
      league(1, standings([40, 17, 30], [PULENI, 17, 16], [41, 17, 16]), null, "2026-04-15"),
      league(2, standings([40, 2, 4], [41, 0, 0], [PULENI, 0, 0]), "2026-12-31"),
    ],
    PULENI,
    "2026-10-12"
  );
  assert.deepEqual(rows, [
    // running first
    {league_id: 2, league_name: "Liga 2", season: "2026", live: true, rank: null, points: null, played: 0},
    // the row number, as the standings page shows it (a tie on points still gives the next place)
    {league_id: 1, league_name: "Liga 1", season: "2025", live: false, rank: 2, points: 16, played: 17},
  ]);
});

test("league rows: running ones first, then the newest; a team missing from the table hasn't played", () => {
  const rows = teamLeagueRows(
    [league(3, standings([PULENI, 4, 6]), null, "2026-01-01"), league(5, standings([PULENI, 1, 2])), league(4, standings([40, 3, 6]))],
    PULENI,
    "2026-10-12"
  );
  assert.deepEqual(
    rows.map((r) => [r.league_id, r.live, r.rank]),
    [
      [5, true, 1],
      [4, true, null],
      [3, false, 1],
    ]
  );
});

test("Najbolje mjesto is the best place where the team has played; a tie goes to the first row", () => {
  const rows = teamLeagueRows(
    [league(1, standings([40, 9, 18], [PULENI, 9, 10])), league(2, standings([PULENI, 6, 12])), league(3, standings([41, 5, 10], [PULENI, 5, 2]))],
    PULENI,
    "2026-10-12"
  );
  assert.deepEqual(bestRank(rows), {rank: 1, league_id: 2, league_name: "Liga 2"});
  const tie = teamLeagueRows([league(6, standings([PULENI, 1, 2]), null, "2026-01-01"), league(7, standings([PULENI, 1, 2]))], PULENI, "2026-10-12");
  assert.deepEqual(bestRank(tie), {rank: 1, league_id: 7, league_name: "Liga 7"});
  assert.equal(bestRank(teamLeagueRows([league(8, standings([PULENI, 0, 0]))], PULENI, "2026-10-12")), null);
  assert.equal(bestRank([]), null);
});

test("a night's result reads pob · ner · por, with ner only after a draw", () => {
  assert.deepEqual(nightParts(3, 0, 1), ["3 pob", "1 por"]);
  assert.deepEqual(nightParts(2, 1, 1), ["2 pob", "1 ner", "1 por"]);
  assert.deepEqual(nightParts(0, 0, 4), ["0 pob", "4 por"]);
});

test("team counts agree with their numbers", () => {
  assert.equal(teamSubline(3, 3), "3 igrača · 3 lige");
  assert.equal(teamSubline(1, 1), "1 igrač · 1 liga");
  assert.equal(teamSubline(0, 0), "0 igrača · 0 liga");
  assert.equal(teamSubline(21, 5), "21 igrač · 5 liga");
});

test("a team's leagues on the Player page show two and count the rest", () => {
  const l = (...names: string[]) => names.map((league_name) => ({league_name}));
  assert.equal(playerTeamLeagues(l()), "");
  assert.equal(playerTeamLeagues(l("Liga 2026")), "Liga 2026");
  assert.equal(playerTeamLeagues(l("Liga 2026", "Liga 2025")), "Liga 2026 · Liga 2025");
  assert.equal(playerTeamLeagues(l("A", "B", "C", "D")), "A · B +2");
});

test("a team's avatar is the first letter of its name", () => {
  assert.equal(teamInitial("Puleni"), "P");
  assert.equal(teamInitial("Ivanovi sinovi"), "I");
  assert.equal(teamInitial("  šljivari"), "Š");
  assert.equal(teamInitial("đaci"), "Đ");
  assert.equal(teamInitial("„Zagorci”"), "Z");
  assert.equal(teamInitial("7 veličanstvenih"), "7");
  assert.equal(teamInitial(""), "?");
  assert.equal(teamInitial(null), "?");
});

const row = (id: number, rank: number, rating: number, rounds: number): RatingRow => ({id, rank, name: `Igrač ${id}`, team: null, rating, change: 12, rounds, provisional: rounds < 8});

test("a rating summary is the player's Rejting row; a player who isn't listed is unranked and provisional", () => {
  const list = [row(7, 1, 1620, 25), row(8, 2, 1540, 3)];
  assert.deepEqual(ratingSummary(list, {id: 8, rating: 1540}), {rating: 1540, change: 12, rounds: 3, provisional: true, rank: 2});
  assert.deepEqual(ratingSummary(list, {id: 7, rating: 1620}), {rating: 1620, change: 12, rounds: 25, provisional: false, rank: 1});
  assert.deepEqual(ratingSummary(list, {id: 282, rating: 1500}), {rating: 1500, change: null, rounds: 0, provisional: true, rank: null});
});

test("a team's chips on the Player page follow the team's rating order; anyone not on Rejting comes last, by name", () => {
  const p = (id: number, first_name: string, last_name: string) => ({id, first_name, last_name});
  const ivan = p(7, "Ivan", "Perić");
  const marko = p(8, "Marko", "Matić");
  const kresimir = p(9, "Krešimir", "Vuković");
  const zrinka = p(10, "Zrinka", "Ćosić");
  const ana = p(11, "Ana", "Šarić");
  const list = [row(7, 1, 1712, 25), row(8, 2, 1542, 25), row(9, 3, 1531, 25)];
  assert.deepEqual(
    inRatingOrder([kresimir, zrinka, ivan, ana, marko], list).map((x) => x.first_name),
    ["Ivan", "Marko", "Krešimir", "Ana", "Zrinka"]
  );
});

test("Osobni podaci: first and last name for everyone, all seven rows for the player and admins", () => {
  const other = {id: 7, first_name: "Ivan", last_name: "Perić", name: "Ivan Perić", active: true};
  assert.deepEqual(personalRows(other, false), [
    {key: "Ime", value: "Ivan"},
    {key: "Prezime", value: "Perić"},
  ]);
  const full = {...other, username: "iperic", email: "ivan@example.com", phone: "091 234 5678", birth_date: "1988-04-12", smoker: true, is_admin: false};
  assert.deepEqual(
    personalRows(full, true).map((r) => `${r.key}: ${r.value}`),
    ["Ime: Ivan", "Prezime: Perić", "Korisničko ime: @iperic", "Email: ivan@example.com", "Mobitel: 091 234 5678", "Datum rođenja: 12.04.1988.", "Pušač: Da"]
  );
  // a Google sign-up without a name, phone or birth date
  const bare = {id: 8, first_name: "", last_name: "", name: "Igrač bez imena", active: true, username: "g123", email: "g@example.com", phone: null, birth_date: null, smoker: false};
  assert.deepEqual(
    personalRows(bare, true).map((r) => r.value),
    ["—", "—", "@g123", "g@example.com", "—", "—", "Ne"]
  );
});

test("the Team page's tiles: the best place with its league, the players, the leagues still running", () => {
  assert.deepEqual(teamTiles({best: {rank: 3, league_id: 1, league_name: "Piatnik Bela Liga 2025"}, players: 4, leagues: 2, leagues_live: 1}), [
    {label: "Najbolje mjesto", value: "#3", sub: "Piatnik Bela Liga 2025"},
    {label: "Igrači", value: "4", sub: "u ekipi"},
    {label: "Lige", value: "2", sub: "1 u tijeku"},
  ]);
  // a new team (13o)
  assert.deepEqual(
    teamTiles({best: null, players: 0, leagues: 0, leagues_live: 0}).map((t) => `${t.value}|${t.sub}`),
    ["–|", "0|u ekipi", "0|0 u tijeku"]
  );
});

test("the Player page's tiles: the place out of everyone on Rejting, the rounds, the teams", () => {
  const rating = {rating: 1684, change: -9, rounds: 24, provisional: false, rank: 2, total: 25};
  assert.deepEqual(playerTiles(rating, [{team_name: "Istrani"}]), [
    {label: "Mjesto", value: "#2", sub: "od 25 igrača"},
    {label: "Odigrano", value: "24", sub: "kola"},
    {label: "Ekipe", value: "1", sub: "Istrani"},
  ]);
  const settling = {rating: 1520, change: 14, rounds: 1, provisional: true, rank: 21, total: 21};
  assert.deepEqual(
    playerTiles(settling, [{team_name: "Puleni"}, {team_name: "Istrani"}]).map((t) => `${t.value}|${t.sub}`),
    ["#21|od 21 igrača", "1|kolo · još privremeno", "2|Puleni, Istrani"]
  );
  // not on Rejting yet, in no team
  const unranked = {rating: 1500, change: null, rounds: 0, provisional: true, rank: null, total: 227};
  assert.deepEqual(playerTiles(unranked, []).map((t) => `${t.value}|${t.sub}`), ["–|od 227 igrača", "0|kola · još privremeno", "0|"]);
});

test("a league row says its season and whether it is still running", () => {
  assert.equal(leagueStatusLine("Jesen 2026", true), "Jesen 2026 · U tijeku");
  assert.equal(leagueStatusLine("Sezona 2025", false), "Sezona 2025 · Završeno");
  assert.equal(leagueStatusLine(null, false), "Završeno");
  assert.equal(leagueStatusLine("  ", true), "U tijeku");
});

test("a Team page's player shows the username only when the server sent it, else the team's name", () => {
  assert.equal(rosterSubline({username: "mmarkovic"}, "Dalmatinci"), "@mmarkovic");
  assert.equal(rosterSubline({username: null}, "Dalmatinci"), "Dalmatinci");
});
