// B · every API route answers guest, player, organizer and admin as the capability map says (_lib/auth/permissions.ts,
// DECISIONS #86), on the live server: adminGuards.test.ts checks that each handler calls a guard, this checks what the
// guard and the checks behind it answer.
//
// One row per route and method (several where ownership or membership splits the answer), one test per row, each role
// calling the route with its own session. The guard decides 401 (guest) and 403 (a role the map doesn't let through,
// "Nemaš ovlasti za ovu radnju."); a role it lets through gets `allowed`, or its exception in `as` (whose tournament,
// whose round, whose profile). The rows change nothing of the world: a role that gets through sends a body that fails
// validation (INVALID, a 400), aims at a row that isn't there (404), or asks for what already is (a lifted ban lifted
// again, a finished tournament's Vrati turnir); such a no-op still moves a row's @updatedAt, which `keep` puts back.
// Where only a real change would get through, that role is SKIP, and the row says why. The tournament reads do what
// every visit does and run the tournament clock: GET /api/tournaments, /api/admin/tournaments and
// /api/tournaments/attention on today's tournaments (none of which these rows aims at), GET /api/admin/tournaments/[id],
// /api/tournaments/[id] and its /results on the tournament read, here the finished ones, where nothing is due any more.
// A new route is one row; the last test fails until it has one.
//
// Bela's section B (Bela f6c8af3) on Treseta's routes: a hand is /api/ongoing-result, there is no Otključaj partiju,
// and the routes Bela's f6c8af3 didn't have get rows of their own: conferences (Treseta's only), Lokacije and Podjela
// (Treseta's, which Bela took over in c80fbb5 after f6c8af3). The season table is public here
// (BELA_SYNC: Gost i poziv isn't copied). A role the app answers wrongly gets a test of its own, test.fail() with its
// `bug` line: Bela's issue or the Bela commit that brings the fix with the sync, or a bug of Treseta's own.
import {capabilitiesOf} from "../../../src/app/_lib/auth/permissions";
import {HAND_POINTS, MATCH_THRESHOLD} from "../../../src/app/_lib/game/scoring";
import {
  appHandlers,
  call,
  DENIED,
  describe,
  expect,
  expected,
  guardLabel,
  INVALID,
  keepPlayer,
  keepTeam,
  matcher,
  NONE,
  NOT_MINE,
  NOT_MY_ROUND,
  refused,
  ROLES,
  SKIP,
  status,
  test,
  urlOf,
  type Ids,
  type Role,
  type Row,
} from "../../helpers/b";

const MANAGE: Row["guard"] = {can: "tournament.manage.own"};

// a Treseta hand as a phone sends it (the 11 points split, no zvanja), for the rows where canPlayRound has to refuse a
// valid one
const hand = (matchId: number) => ({match_id: matchId, team1_game_points: 6, team2_game_points: HAND_POINTS - 6, custom: false});
// the same hand as the admin's scorepad sends it (AdminHandValidation)
const ADMIN_HAND = {custom: false, points1: 6, points2: HAND_POINTS - 6};

// Treseta's team routes before Bela's Organizator commit (28d19f2, on bela-sync) comes with the sync
const TEAMS_BUG = "Bela 28d19f2, comes with the sync: ";

// The organizer's two finished tournaments' worth of rows for a route of one tournament: on the admin's the
// organizer is refused by ownership, on their own they get what the admin gets
function ownership(base: Omit<Row, "note" | "params" | "as">, params: (t: Ids["adminTournament"]) => Record<string, string | number>): Row[] {
  return [
    {...base, note: "the admin's tournament", params: (i) => params(i.adminTournament), as: {organizer: NOT_MINE}},
    {...base, note: "the organizer's own tournament", params: (i) => params(i.ownTournament)},
  ];
}

// The same for a table or a hand of the scorepad: a league's (the admin's alone, league.manage), the admin's
// tournament's, the organizer's own tournament's
function scorepad(base: Omit<Row, "note" | "params" | "as">, league: (i: Ids) => Record<string, string | number>, tournament: (t: Ids["adminTournament"]) => Record<string, string | number>): Row[] {
  return [{...base, note: "a league table", params: league, as: {organizer: DENIED}}, ...ownership(base, tournament)];
}

const ROWS: Row[] = [
  // ---------- Zabrana prijava: the admin's (ban.manage.own isn't the organizer's, DECISIONS #86) ----------
  {method: "GET", route: "/api/admin/bans", query: (i) => `team_id=${i.bannedTeam}`, guard: "admin", allowed: status(200)},
  {method: "POST", route: "/api/admin/bans", body: INVALID, guard: "admin", allowed: status(400)},
  {method: "PATCH", route: "/api/admin/bans/[id]", params: (i) => ({id: i.liftedBan}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "DELETE", route: "/api/admin/bans/[id]", note: "a ban already lifted", params: (i) => ({id: i.liftedBan}), guard: "admin", allowed: status(204)},

  // ---------- the scorepad: the admin on a league night, the organizer on their own tournament ----------
  // BUG: Treseta's PUT parses the hand before refuseUnlessMyHand (its tournament port 543f6e46), so the organizer's
  // malformed hand at a table that isn't theirs is a 400 instead of the refusal. Bela checks whose table it is first
  // (Bela 28d19f2), but the sync won't bring it: bela-sync has Treseta's order too. The two rows after these show the
  // refusal with a hand that parses.
  {
    method: "PUT",
    route: "/api/admin/hands/[kind]/[resultId]",
    note: "a league table",
    params: (i) => ({kind: "ongoing", resultId: i.playerTable.hand}),
    body: INVALID,
    guard: MANAGE,
    allowed: status(400),
    as: {organizer: DENIED},
    bug: {role: "organizer", text: "the hand is parsed before refuseUnlessMyHand (Treseta 543f6e46; Bela 28d19f2 refuses first), so the organizer's malformed hand at a league table is 400 Igra nije spremljena., not 403"},
  },
  {
    method: "PUT",
    route: "/api/admin/hands/[kind]/[resultId]",
    note: "the admin's tournament",
    params: (i) => ({kind: "finished", resultId: i.adminTournament.hand}),
    body: INVALID,
    guard: MANAGE,
    allowed: status(400),
    as: {organizer: NOT_MINE},
    bug: {role: "organizer", text: "the hand is parsed before refuseUnlessMyHand (Treseta 543f6e46; Bela 28d19f2 refuses first), so the organizer's malformed hand on the admin's tournament is 400 Igra nije spremljena., not 403 Ovo nije tvoj turnir."},
  },
  {method: "PUT", route: "/api/admin/hands/[kind]/[resultId]", note: "the organizer's own tournament", params: (i) => ({kind: "finished", resultId: i.ownTournament.hand}), body: INVALID, guard: MANAGE, allowed: status(400)},
  // a hand that parses reaches the ownership check on Treseta too: refused to the organizer at a table that isn't
  // theirs; the admin's would be saved, so the admin is SKIP
  {method: "PUT", route: "/api/admin/hands/[kind]/[resultId]", note: "a valid hand at a league table", params: (i) => ({kind: "ongoing", resultId: i.playerTable.hand}), body: ADMIN_HAND, guard: MANAGE, allowed: status(200), as: {organizer: DENIED, admin: SKIP}},
  {method: "PUT", route: "/api/admin/hands/[kind]/[resultId]", note: "a valid hand on the admin's tournament", params: (i) => ({kind: "finished", resultId: i.adminTournament.hand}), body: ADMIN_HAND, guard: MANAGE, allowed: status(200), as: {organizer: NOT_MINE, admin: SKIP}},
  // deleting a real hand would go through for whoever owns it: the admin is SKIP there, and the owners' way through is
  // shown by a hand that isn't there
  {method: "DELETE", route: "/api/admin/hands/[kind]/[resultId]", note: "a league table", params: (i) => ({kind: "ongoing", resultId: i.playerTable.hand}), guard: MANAGE, allowed: status(204), as: {organizer: DENIED, admin: SKIP}},
  {method: "DELETE", route: "/api/admin/hands/[kind]/[resultId]", note: "the admin's tournament", params: (i) => ({kind: "finished", resultId: i.adminTournament.hand}), guard: MANAGE, allowed: status(204), as: {organizer: NOT_MINE, admin: SKIP}},
  {method: "DELETE", route: "/api/admin/hands/[kind]/[resultId]", note: "a hand that isn't there", params: () => ({kind: "ongoing", resultId: NONE}), guard: MANAGE, allowed: refused(404, "Igra ne postoji.")},
  ...scorepad(
    {method: "GET", route: "/api/admin/tables/[roundId]", guard: MANAGE, allowed: status(200)},
    (i) => ({roundId: i.playerTable.round}),
    (t) => ({roundId: t.table})
  ),
  ...scorepad(
    {method: "PATCH", route: "/api/admin/tables/[roundId]", body: INVALID, guard: MANAGE, allowed: status(400)},
    (i) => ({roundId: i.playerTable.round}),
    (t) => ({roundId: t.table})
  ),
  // removing a real table would go through for its owner: the admin is SKIP there
  {method: "DELETE", route: "/api/admin/tables/[roundId]", note: "a league table", params: (i) => ({roundId: i.playedTable}), guard: MANAGE, allowed: status(204), as: {organizer: DENIED, admin: SKIP}},
  {method: "DELETE", route: "/api/admin/tables/[roundId]", note: "the admin's tournament", params: (i) => ({roundId: i.adminTournament.table}), guard: MANAGE, allowed: status(204), as: {organizer: NOT_MINE, admin: SKIP}},
  {method: "DELETE", route: "/api/admin/tables/[roundId]", note: "a table that isn't there", params: () => ({roundId: NONE}), guard: MANAGE, allowed: refused(404, "Stol ne postoji.")},
  // Završi meč at a table where no match is being played
  ...scorepad(
    {method: "POST", route: "/api/admin/tables/[roundId]/finish", guard: MANAGE, allowed: refused(404, "Za ovim stolom se trenutno ne igra meč.")},
    (i) => ({roundId: i.playedTable}),
    (t) => ({roundId: t.table})
  ),
  ...scorepad(
    {method: "POST", route: "/api/admin/tables/[roundId]/hands", body: INVALID, guard: MANAGE, allowed: status(400)},
    (i) => ({roundId: i.playerTable.round}),
    (t) => ({roundId: t.table})
  ),

  // ---------- Upravljanje ligom: the admin's ----------
  {method: "GET", route: "/api/admin/leagues/[leagueId]/rounds", params: (i) => ({leagueId: i.league}), guard: "admin", allowed: status(200)},
  {method: "DELETE", route: "/api/admin/leagues/[leagueId]/rounds", note: "no Kolo named", params: (i) => ({leagueId: i.league}), guard: "admin", allowed: status(400)},
  {method: "POST", route: "/api/admin/leagues/[leagueId]/tables", params: (i) => ({leagueId: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues", guard: "public", allowed: status(200)},
  {method: "POST", route: "/api/leagues", body: INVALID, guard: "admin", allowed: status(400)},
  {method: "PATCH", route: "/api/leagues/[id]", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/arrivals", params: (i) => ({id: i.league}), guard: "admin", allowed: status(200)},
  {method: "POST", route: "/api/leagues/[id]/arrivals", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/create-round-draft", params: (i) => ({id: i.league}), guard: "admin", allowed: status(200)},
  {method: "PUT", route: "/api/leagues/[id]/create-round-draft", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/nights", params: (i) => ({id: i.league}), guard: "public", allowed: status(200)},
  {method: "POST", route: "/api/leagues/[id]/nights", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "PATCH", route: "/api/leagues/[id]/nights/[date]", note: "not a date", params: (i) => ({id: i.league, date: "not-a-date"}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "DELETE", route: "/api/leagues/[id]/nights/[date]", note: "not a date", params: (i) => ({id: i.league, date: "not-a-date"}), guard: "admin", allowed: status(400)},
  {method: "POST", route: "/api/leagues/[id]/nights/[date]/approve", note: "not a date", params: (i) => ({id: i.league, date: "not-a-date"}), guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/nights/[date]/draft", note: "tonight's Skica", params: (i) => ({id: i.league, date: i.night}), guard: "admin", allowed: status(200)},
  {method: "DELETE", route: "/api/leagues/[id]/nights/[date]/draft", note: "not a date", params: (i) => ({id: i.league, date: "not-a-date"}), guard: "admin", allowed: status(400)},
  {method: "POST", route: "/api/leagues/[id]/nights/[date]/publish", note: "not a date", params: (i) => ({id: i.league, date: "not-a-date"}), guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/notes", params: (i) => ({id: i.league}), guard: "admin", allowed: status(200)},
  {method: "PUT", route: "/api/leagues/[id]/notes", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/smoking", params: (i) => ({id: i.league}), guard: "admin", allowed: status(200)},
  {method: "GET", route: "/api/leagues/[id]/sponsors", params: (i) => ({id: i.league}), guard: "public", allowed: status(200)},
  {method: "PUT", route: "/api/leagues/[id]/sponsors", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/teams", params: (i) => ({id: i.league}), guard: "admin", allowed: status(200)},
  {method: "POST", route: "/api/leagues/[id]/teams", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "PATCH", route: "/api/leagues/[id]/teams/[teamId]", params: (i) => ({id: i.league, teamId: i.otherLeagueTeam}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "DELETE", route: "/api/leagues/[id]/teams/[teamId]", note: "a team not in the league", params: (i) => ({id: i.league, teamId: NONE}), guard: "admin", allowed: refused(404, "Ekipa nije u ovoj ligi.")},
  // Conferences, Treseta's only (read by anyone, like the season table that shows them; saved by the admin), and the
  // Podjela of a two-place night (the admin's; Treseta's, which Bela took over in c80fbb5)
  {method: "GET", route: "/api/leagues/[id]/conferences", params: (i) => ({id: i.league}), guard: "public", allowed: status(200)},
  {method: "PUT", route: "/api/leagues/[id]/conferences", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "PUT", route: "/api/leagues/[id]/conferences/teams", params: (i) => ({id: i.league}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/leagues/[id]/nights/[date]/split", note: "tonight", params: (i) => ({id: i.league, date: i.night}), guard: "admin", allowed: status(200)},
  {method: "PUT", route: "/api/leagues/[id]/nights/[date]/split", note: "tonight", params: (i) => ({id: i.league, date: i.night}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "POST", route: "/api/rounds/generate-multiple", body: INVALID, guard: "admin", allowed: status(400)},
  // Odobri / Poništi odobrenje of a round already published: it can't change
  {method: "PATCH", route: "/api/rounds/[id]/approve", note: "a published round", params: (i) => ({id: i.playerTable.round}), guard: "admin", allowed: status(400)},
  {method: "PATCH", route: "/api/rounds/[id]/unapprove", note: "a published round", params: (i) => ({id: i.playerTable.round}), guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/matches", guard: "admin", allowed: status(200)},

  // ---------- the league for the players: a login, but for the season table ----------
  // Ukupni poredak is public on Treseta (BELA_SYNC, Not copied: Gost i poziv; Bela asks a login since DECISIONS #75)
  {method: "GET", route: "/api/leagues/[id]/standings", params: (i) => ({id: i.league}), guard: "public", allowed: status(200)},
  {method: "GET", route: "/api/leagues/[id]/daily-standings", params: (i) => ({id: i.league}), query: (i) => `date=${i.night}`, guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/leagues/[id]/round-dates", params: (i) => ({id: i.league}), guard: "user", allowed: status(200)},
  {method: "POST", route: "/api/leagues/[id]/arrival", params: (i) => ({id: i.league}), body: INVALID, guard: "user", allowed: status(400)},
  // Tu smo is a team's own: for a team you don't play in, nobody (the admin's switch is /arrivals)
  {method: "POST", route: "/api/leagues/[id]/arrival", note: "someone else's team", params: (i) => ({id: i.league}), body: (i: Ids) => ({team_id: i.otherLeagueTeam, action: "confirm"}), guard: "user", allowed: refused(404, "Tvoja ekipa nije u ovoj ligi.")},
  {method: "GET", route: "/api/rounds", query: (i) => `round_date=${i.night}&league_id=${i.league}`, guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/rounds/[id]", note: "a published table", params: (i) => ({id: i.playerTable.round}), guard: "user", allowed: status(200)},
  // a round not published yet is the admin's alone (Upravljanje ligom · Skica); anyone else: as if it weren't there
  {method: "GET", route: "/api/rounds/[id]", note: "a Skica table", params: (i) => ({id: i.draftTable}), guard: "user", allowed: refused(404, "Runda ne postoji."), as: {admin: status(200)}},
  {method: "GET", route: "/api/rounds/[id]/matches", note: "a published table", params: (i) => ({id: i.playerTable.round}), guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/rounds/[id]/matches", note: "a Skica table", params: (i) => ({id: i.draftTable}), guard: "user", allowed: refused(404, "Runda ne postoji."), as: {admin: status(200)}},
  {method: "GET", route: "/api/rounds/[id]/overview", note: "a published table", params: (i) => ({id: i.playerTable.round}), guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/rounds/[id]/overview", note: "a Skica table", params: (i) => ({id: i.draftTable}), guard: "user", allowed: refused(404, "Stol ne postoji."), as: {admin: status(200)}},
  // the round the player plays now; the organizer and the admin play at no table tonight
  {method: "GET", route: "/api/rounds/open", guard: "user", allowed: refused(404, "Trenutno nemaš otvorenu rundu."), as: {player: status(200)}},
  {method: "GET", route: "/api/schedule", guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/ratings", guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/ratings/[playerId]", params: (i) => ({playerId: i.partner}), guard: "user", allowed: status(200)},

  // ---------- at the table: the round's players (canPlayRound), and the admin ----------
  // Tko igra: the players of the table and the admin
  {method: "GET", route: "/api/rounds/[id]/lineup", note: "the player's table", params: (i) => ({id: i.playerTable.round}), guard: "user", allowed: status(200), as: {organizer: NOT_MY_ROUND}},
  {method: "GET", route: "/api/rounds/[id]/lineup", note: "someone else's table", params: (i) => ({id: i.otherTable.round}), guard: "user", allowed: status(200), as: {player: NOT_MY_ROUND, organizer: NOT_MY_ROUND}},
  // BUG (Bela #83, f0a8b44): the organizer's scorepad on their own tournament opens on Tko igra (needsLineup), and Tko igra
  // is refused them; Bela's fix (managesRound) isn't on bela-sync yet and comes with the sync.
  // A finished table (the world's only one of the organizer's) also passes lineupVisible and saveLineup's admin flag,
  // which let an admin past a finished round: the organizer runs their own tournament's tables as the admin does (#86).
  {
    method: "GET",
    route: "/api/rounds/[id]/lineup",
    note: "a finished table of the organizer's own tournament",
    params: (i) => ({id: i.ownTournament.table}),
    guard: "user",
    allowed: status(200),
    as: {player: NOT_MY_ROUND},
    bug: {
      role: "organizer",
      text: "Bela #83 (f0a8b44, comes with the sync): Tko igra treats the organizer as a stranger at their own tournament's table: canPlayRound (403 Ne igraš u ovoj rundi.), then lineupVisible (403 Ova runda je već završena. on a finished table) let only the ADMIN role through",
    },
  },
  {method: "PUT", route: "/api/rounds/[id]/lineup", note: "the player's table", params: (i) => ({id: i.playerTable.round}), body: INVALID, guard: "user", allowed: status(400), as: {organizer: NOT_MY_ROUND}},
  {method: "PUT", route: "/api/rounds/[id]/lineup", note: "someone else's table", params: (i) => ({id: i.otherTable.round}), body: INVALID, guard: "user", allowed: status(400), as: {player: NOT_MY_ROUND, organizer: NOT_MY_ROUND}},
  // BUG (Bela #83, f0a8b44): as above, Potvrdi i počni. INVALID fails before saveLineup, so this row sees canPlayRound
  // alone; saveLineup's own admin flag (Ova runda je već završena. on a finished table) is the same bug's third check
  {
    method: "PUT",
    route: "/api/rounds/[id]/lineup",
    note: "a finished table of the organizer's own tournament",
    params: (i) => ({id: i.ownTournament.table}),
    body: INVALID,
    guard: "user",
    allowed: status(400),
    as: {player: NOT_MY_ROUND},
    bug: {
      role: "organizer",
      text: "Bela #83 (f0a8b44, comes with the sync): Potvrdi i počni treats the organizer as a stranger at their own tournament's table: canPlayRound (403 Ne igraš u ovoj rundi.), then saveLineup's admin flag on a finished table let only the ADMIN role through",
    },
  },
  {method: "POST", route: "/api/rounds/[id]/attendance", params: (i) => ({id: i.playerTable.round}), body: INVALID, guard: "user", allowed: status(400)},
  // Jesu li … za stolom? is the question of the table's players alone, the admin's neither (they have Uredi ishod):
  // refused before anything is written
  {method: "POST", route: "/api/rounds/[id]/attendance", note: "someone else's tournament table", params: (i) => ({id: i.adminTournament.table}), body: {answer: "PRESENT"}, guard: "user", allowed: refused(400, "Ovo pitanje je za igrače tog stola.")},
  // a valid match, hand or table of someone else's round: refused to the player and the organizer; the admin's would
  // go through (Završi meč, a hand saved, a match started), so the admin is SKIP there
  {method: "POST", route: "/api/ongoing-matches", body: INVALID, guard: "user", allowed: status(400)},
  {method: "POST", route: "/api/ongoing-matches", note: "someone else's table", body: (i: Ids) => ({round_id: i.otherTable.round, score_threshold: MATCH_THRESHOLD}), guard: "user", allowed: NOT_MY_ROUND, as: {admin: SKIP}},
  {method: "GET", route: "/api/ongoing-matches/[id]", params: (i) => ({id: i.playerTable.match}), guard: "user", allowed: status(200)},
  {method: "POST", route: "/api/ongoing-result", body: INVALID, guard: "user", allowed: status(400)},
  {method: "POST", route: "/api/ongoing-result", note: "someone else's table", body: (i: Ids) => hand(i.otherTable.match), guard: "user", allowed: NOT_MY_ROUND, as: {admin: SKIP}},
  {method: "GET", route: "/api/ongoing-result/[id]", params: (i) => ({id: i.playerTable.hand}), guard: "user", allowed: status(200)},
  {method: "PUT", route: "/api/ongoing-result/[id]", params: (i) => ({id: i.playerTable.hand}), body: INVALID, guard: "user", allowed: status(400)},
  {method: "PUT", route: "/api/ongoing-result/[id]", note: "someone else's table", params: (i) => ({id: i.otherTable.hand}), body: (i: Ids) => hand(i.otherTable.match), guard: "user", allowed: NOT_MY_ROUND, as: {admin: SKIP}},
  {method: "POST", route: "/api/matches", body: INVALID, guard: "user", allowed: status(400)},
  {method: "POST", route: "/api/matches", note: "someone else's table", body: (i: Ids) => i.otherTable.match, guard: "user", allowed: NOT_MY_ROUND, as: {admin: SKIP}},

  // ---------- tournaments: the admin's Upravljanje turnirom, and the organizer's own (tournament.manage.own) ----------
  {method: "GET", route: "/api/admin/tournaments", guard: MANAGE, allowed: status(200)},
  {method: "POST", route: "/api/admin/tournaments", body: INVALID, guard: {can: "tournament.create"}, allowed: status(400)},
  ...ownership({method: "GET", route: "/api/admin/tournaments/[id]", guard: MANAGE, allowed: status(200)}, (t) => ({id: t.id})),
  ...ownership({method: "PATCH", route: "/api/admin/tournaments/[id]", body: INVALID, guard: MANAGE, allowed: status(400)}, (t) => ({id: t.id})),
  // Obriši turnir is the admin's alone, the organizer's own tournament too (they have Otkaži); a started one can't go
  {method: "DELETE", route: "/api/admin/tournaments/[id]", note: "the admin's tournament, started", params: (i) => ({id: i.adminTournament.id}), guard: "admin", allowed: status(400)},
  {method: "DELETE", route: "/api/admin/tournaments/[id]", note: "the organizer's own tournament, started", params: (i) => ({id: i.ownTournament.id}), guard: "admin", allowed: status(400)},
  // Otkaži a started tournament: refused; Vrati turnir one that isn't cancelled: nothing to do. Treseta's map as it is
  // (tournament.manage.own): Bela's 8db335f (DECISIONS #99) makes both the admin's alone, and these rows change with it
  // when it comes over
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/cancel", guard: MANAGE, allowed: refused(400, "Turnir je već počeo i ne može se otkazati.")}, (t) => ({id: t.id})),
  ...ownership({method: "DELETE", route: "/api/admin/tournaments/[id]/cancel", guard: MANAGE, allowed: status(200)}, (t) => ({id: t.id})),
  ...ownership({method: "GET", route: "/api/admin/tournaments/[id]/candidates", guard: MANAGE, allowed: status(200)}, (t) => ({id: t.id})),
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/kola", body: INVALID, guard: MANAGE, allowed: status(400)}, (t) => ({id: t.id})),
  // Kolo 99: Dodaj kolo refuses it (not the next one), Obriši kolo finds nothing, Objavi kolo has no Skica of it
  ...ownership({method: "PUT", route: "/api/admin/tournaments/[id]/kola/[n]", guard: MANAGE, allowed: status(400)}, (t) => ({id: t.id, n: 99})),
  ...ownership({method: "DELETE", route: "/api/admin/tournaments/[id]/kola/[n]", guard: MANAGE, allowed: status(200)}, (t) => ({id: t.id, n: 99})),
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/kola/[n]/publish", guard: MANAGE, allowed: refused(404, "Skica tog kola ne postoji.")}, (t) => ({id: t.id, n: 99})),
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/kola/[n]/tables", body: INVALID, guard: MANAGE, allowed: status(400)}, (t) => ({id: t.id, n: 1})),
  ...ownership({method: "PATCH", route: "/api/admin/tournaments/[id]/registrations", body: INVALID, guard: MANAGE, allowed: status(400)}, (t) => ({id: t.id})),
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/tables/[tableId]/outcome", body: INVALID, guard: MANAGE, allowed: status(400)}, (t) => ({id: t.id, tableId: t.table})),
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/tables/[tableId]/restore", guard: MANAGE, allowed: refused(404, "Stol ne postoji.")}, (t) => ({id: t.id, tableId: NONE})),
  // a finished tournament's sign-ups and waiting list stay as they were (refuseIfFinished)
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/teams", body: INVALID, guard: MANAGE, allowed: refused(400, "Turnir je završen: prijave i lista čekanja se više ne mijenjaju.")}, (t) => ({id: t.id})),
  ...ownership({method: "PATCH", route: "/api/admin/tournaments/[id]/teams/[teamId]", body: INVALID, guard: MANAGE, allowed: refused(400, "Turnir je završen: prijave i lista čekanja se više ne mijenjaju.")}, (t) => ({id: t.id, teamId: t.team})),
  ...ownership({method: "DELETE", route: "/api/admin/tournaments/[id]/teams/[teamId]", guard: MANAGE, allowed: refused(400, "Turnir je završen: prijave i lista čekanja se više ne mijenjaju.")}, (t) => ({id: t.id, teamId: t.team})),
  // BUG (Bela #84, open; shared code): Makni ekipu on the organizer's own tournament before its start, which DECISIONS #86
  // gives them (sign-ups)
  {
    method: "DELETE",
    route: "/api/admin/tournaments/[id]/teams/[teamId]",
    note: "the organizer's own tournament before its start",
    params: (i) => ({id: i.upcomingOwnTournament.id, teamId: i.upcomingOwnTournament.team}),
    guard: MANAGE,
    allowed: status(200),
    // the admin's would take the team out too
    as: {admin: SKIP},
    bug: {
      role: "organizer",
      text: "Bela #84: signOff lets only the ADMIN role remove a team they don't play in, so the organizer's Makni ekipu on their own tournament is 400 Možeš odjaviti samo ekipu u kojoj igraš.",
    },
    // once it works the team is out: back in, as it was
    keep: async (db, i) => {
      const key = {tournament_id_team_id: {tournament_id: i.upcomingOwnTournament.id, team_id: i.upcomingOwnTournament.team}};
      const entry = await db.tournamentTeam.findUniqueOrThrow({where: key});
      return async () => {
        if (!(await db.tournamentTeam.findUnique({where: key}))) await db.tournamentTeam.create({data: entry});
      };
    },
  },
  ...ownership({method: "POST", route: "/api/admin/tournaments/[id]/teams/[teamId]/admit", guard: MANAGE, allowed: refused(400, "Turnir je završen: prijave i lista čekanja se više ne mijenjaju.")}, (t) => ({id: t.id, teamId: t.team})),

  // ---------- tournaments for the players ----------
  {method: "GET", route: "/api/tournaments", guard: "public", allowed: status(200)},
  {method: "GET", route: "/api/tournaments/[id]", params: (i) => ({id: i.adminTournament.id}), guard: "public", allowed: status(200)},
  {method: "GET", route: "/api/tournaments/[id]/results", params: (i) => ({id: i.adminTournament.id}), guard: "public", allowed: status(200)},
  {method: "GET", route: "/api/tournaments/attention", guard: "user", allowed: status(200)},
  {method: "POST", route: "/api/tournaments/[id]/arrival", params: (i) => ({id: i.openTournament.id}), body: INVALID, guard: "user", allowed: status(400)},
  {method: "POST", route: "/api/tournaments/[id]/registrations", params: (i) => ({id: i.openTournament.id}), body: INVALID, guard: "user", allowed: status(400)},
  {method: "DELETE", route: "/api/tournaments/[id]/registrations/[teamId]", note: "a started tournament", params: (i) => ({id: i.adminTournament.id, teamId: i.adminTournament.team}), guard: "user", allowed: refused(400, "Turnir je već počeo.")},
  // Odjavi se s turnira is a team's own; the admin's would sign the team off (it is Makni ekipu for them)
  {method: "DELETE", route: "/api/tournaments/[id]/registrations/[teamId]", note: "someone else's team", params: (i) => ({id: i.openTournament.id, teamId: i.openTournament.team}), guard: "user", allowed: refused(400, "Možeš odjaviti samo ekipu u kojoj igraš."), as: {admin: SKIP}},

  // ---------- teams: Nova ekipa and its players for the admin and the organizer (team.create, team.edit) ----------
  // BUG (Bela 28d19f2): the map gives the organizer team.create and team.edit, but Treseta's team routes still ask the
  // ADMIN role (requireAdmin, isAdminRole), as before the organizer came: Bela's Organizator commit turns them into
  // requireCan and comes with the sync (on bela-sync). The organizer's test of each such row is test.fail().
  {method: "GET", route: "/api/teams", guard: "user", allowed: status(200)},
  {method: "POST", route: "/api/teams", body: INVALID, guard: {can: "team.create"}, allowed: status(400), bug: {role: "organizer", text: `${TEAMS_BUG}Nova ekipa is requireAdmin, so the organizer (team.create) gets 403 Nemaš ovlasti za ovu radnju.`}},
  {method: "GET", route: "/api/teams/[id]", params: (i) => ({id: i.playerTeam.id}), guard: "user", allowed: status(200)},
  {method: "PATCH", route: "/api/teams/[id]", params: (i) => ({id: i.playerTeam.id}), body: INVALID, guard: "user", allowed: status(400)},
  // renaming is team.edit (to the name it has: nothing changes)
  {method: "PATCH", route: "/api/teams/[id]", note: "rename to its own name", params: (i) => ({id: i.playerTeam.id}), body: (i: Ids) => ({team_name: i.playerTeam.name}), guard: "user", allowed: status(200), as: {player: refused(403, "Ime ekipe mijenja admin.")}, keep: keepTeam((i) => i.playerTeam.id), bug: {role: "organizer", text: `${TEAMS_BUG}renaming asks the ADMIN role, so the organizer (team.edit) gets 403 Ime ekipe mijenja admin.`}},
  // Zabrani novu sliku is team.moderate, the admin's alone (to what it is: nothing changes)
  {method: "PATCH", route: "/api/teams/[id]", note: "Zabrani novu sliku", params: (i) => ({id: i.playerTeam.id}), body: {photo_blocked: false}, guard: "user", allowed: refused(403, "Samo admin može zabraniti sliku."), as: {admin: status(200)}, keep: keepTeam((i) => i.playerTeam.id)},
  // who sees the photo is the team's players' choice, not the admin's (to what it is: nothing changes)
  {method: "PATCH", route: "/api/teams/[id]", note: "who sees the photo", params: (i) => ({id: i.playerTeam.id}), body: {photo_visibility: "ALL"}, guard: "user", allowed: refused(403, "Tko vidi sliku ekipe biraju njezini igrači."), as: {player: status(200)}, keep: keepTeam((i) => i.playerTeam.id)},
  {method: "DELETE", route: "/api/teams/[id]", note: "a team that has played", params: (i) => ({id: i.playerTeam.id}), guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/teams/[id]/overview", params: (i) => ({id: i.playerTeam.id}), guard: "user", allowed: status(200)},
  {method: "POST", route: "/api/teams/[id]/players", params: (i) => ({id: i.playerTeam.id}), body: INVALID, guard: {can: "team.edit"}, allowed: status(400), bug: {role: "organizer", text: `${TEAMS_BUG}Dodaj igrača is requireAdmin, so the organizer (team.edit) gets 403 Nemaš ovlasti za ovu radnju.`}},
  {
    method: "DELETE",
    route: "/api/teams/[id]/players/[playerId]",
    note: "a player not in the team",
    params: (i) => ({id: i.playerTeam.id, playerId: NONE}),
    guard: {can: "team.edit"},
    allowed: refused(404, "Igrač nije u ovoj ekipi."),
    bug: {role: "organizer", text: `${TEAMS_BUG}Makni igrača is requireAdmin, so the organizer (team.edit) gets 403 Nemaš ovlasti za ovu radnju.`},
  },
  {method: "GET", route: "/api/teams/[id]/photo", params: (i) => ({id: i.teamPhotoForAll}), guard: "user", allowed: status(200)},
  // a team's photo is set by its players alone, the admin included
  {method: "PUT", route: "/api/teams/[id]/photo", params: (i) => ({id: i.playerTeam.id}), body: INVALID, guard: "user", allowed: refused(403, "Sliku ekipe mogu mijenjati samo njezini igrači."), as: {player: status(400)}},
  // …and removed by them or the admin (a team without a photo: nothing to remove, but who did it is written down)
  {
    method: "DELETE",
    route: "/api/teams/[id]/photo",
    note: "a team without a photo",
    params: (i) => ({id: i.playerTeam.id}),
    guard: "user",
    allowed: status(200),
    as: {organizer: refused(403, "Sliku ekipe mogu mijenjati samo njezini igrači.")},
    keep: keepTeam((i) => i.playerTeam.id),
  },

  // ---------- players: Igrači for the admin and the organizer (player.directory); a profile is its player's ----------
  {method: "GET", route: "/api/admin/players", guard: {can: "player.directory"}, allowed: status(200)},
  {method: "PATCH", route: "/api/admin/players/[id]", params: (i) => ({id: i.partner}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "DELETE", route: "/api/admin/players/[id]", note: "a player who isn't there", params: () => ({id: NONE}), guard: "admin", allowed: refused(404, "Igrač ne postoji.")},
  {method: "PATCH", route: "/api/admin/players/[id]/active", params: (i) => ({id: i.partner}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "GET", route: "/api/players/search", query: "q=an", guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/players/[id]", params: (i) => ({id: i.partner}), guard: "user", allowed: status(200)},
  {method: "PATCH", route: "/api/players/[id]", note: "one's own profile", params: (_, me) => ({id: me}), body: INVALID, guard: "user", allowed: status(400)},
  // someone else's profile: the admin's alone
  {method: "PATCH", route: "/api/players/[id]", note: "someone else's profile", params: (i) => ({id: i.partner}), body: INVALID, guard: "user", allowed: refused(403, "Možeš mijenjati samo svoj profil."), as: {admin: status(400)}},
  // Zabrani novu sliku is the admin's (on their own profile, to what it is: nothing changes)
  {method: "PATCH", route: "/api/players/[id]", note: "Zabrani novu sliku on one's own profile", params: (_, me) => ({id: me}), body: {photo_blocked: false}, guard: "user", allowed: refused(403, "Samo admin može zabraniti sliku."), as: {admin: status(200)}, keep: keepPlayer((i) => i.me.admin)},
  // who sees the photo is the player's own choice, not the admin's
  {method: "PATCH", route: "/api/players/[id]", note: "who sees someone else's photo", params: (i) => ({id: i.partner}), body: {photo_visibility: "ALL"}, guard: "user", allowed: refused(403, "Možeš mijenjati samo svoj profil."), as: {admin: refused(403, "Tko vidi sliku bira sam igrač.")}},
  {method: "GET", route: "/api/players/[id]/overview", params: (i) => ({id: i.partner}), guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/players/[id]/photo", note: "a photo for everyone", params: (i) => ({id: i.photoForAll}), guard: "user", allowed: status(200)},
  // a photo for teammates: the player and the admin see it, the organizer (no teammate) gets no photo
  {method: "GET", route: "/api/players/[id]/photo", note: "a photo for teammates", params: (i) => ({id: i.photoForTeammates}), guard: "user", allowed: status(200), as: {organizer: status(404)}},
  {method: "PUT", route: "/api/players/[id]/photo", note: "one's own", params: (_, me) => ({id: me}), body: INVALID, guard: "user", allowed: status(400)},
  // only the player sets their photo, the admin included
  {method: "PUT", route: "/api/players/[id]/photo", note: "someone else's", params: (i) => ({id: i.partner}), body: INVALID, guard: "user", allowed: refused(403, "Sliku može postaviti samo igrač na svom profilu.")},
  // …and the player or the admin removes it (a player without a photo: nothing to remove)
  {method: "DELETE", route: "/api/players/[id]/photo", note: "someone else's, without a photo", params: (i) => ({id: i.partner}), guard: "user", allowed: refused(403, "Sliku može postaviti samo igrač na svom profilu."), as: {admin: status(200)}, keep: keepPlayer((i) => i.partner)},
  {method: "GET", route: "/api/players/me/google-photo", note: "no Google picture", guard: "user", allowed: status(404)},
  // who is logged in: the route answers nobody itself, 401 {user: null} without a message (the app then shows Prijava)
  {method: "GET", route: "/api/auth/me", guard: "public", allowed: status(200), as: {guest: status(401)}},

  // ---------- Lokacije (Treseta's, which Bela took over in c80fbb5): the list and a new place for whoever picks one
  // (location.create: the admin, and the organizer on the tournament form); changing and deleting a place is the
  // admin's (location.manage) ----------
  {method: "GET", route: "/api/locations", guard: {can: "location.create"}, allowed: status(200)},
  {method: "POST", route: "/api/locations", body: INVALID, guard: {can: "location.create"}, allowed: status(400)},
  {method: "PATCH", route: "/api/locations/[id]", params: (i) => ({id: i.placeInUse}), body: INVALID, guard: {can: "location.manage"}, allowed: status(400)},
  // a place a league and the tournaments use can't go (the place nothing uses would be deleted for the admin)
  {method: "DELETE", route: "/api/locations/[id]", note: "a place in use", params: (i) => ({id: i.placeInUse}), guard: {can: "location.manage"}, allowed: refused(400, "Lokacija se koristi, pa se ne može obrisati.")},
  {method: "DELETE", route: "/api/locations/[id]", note: "a place that isn't there", params: () => ({id: NONE}), guard: {can: "location.manage"}, allowed: refused(404, "Lokacija ne postoji.")},

  // ---------- Sponzori: the admin's; the logos are public ----------
  {method: "GET", route: "/api/admin/sponsors", guard: "admin", allowed: status(200)},
  {method: "POST", route: "/api/admin/sponsors", body: INVALID, guard: "admin", allowed: status(400)},
  {method: "PATCH", route: "/api/admin/sponsors/[id]", params: (i) => ({id: i.sponsor}), body: INVALID, guard: "admin", allowed: status(400)},
  {method: "DELETE", route: "/api/admin/sponsors/[id]", note: "a sponsor who isn't there", params: () => ({id: NONE}), guard: "admin", allowed: status(404)},
  {method: "GET", route: "/api/sponsors/[id]/logo", params: (i) => ({id: i.sponsor}), guard: "public", allowed: status(200)},
  {method: "POST", route: "/api/sponsors/events", body: INVALID, guard: "user", allowed: status(400)},

  // ---------- Burza: ads are public, an ad is its author's; the admin closes anyone's ----------
  {method: "GET", route: "/api/burza", guard: "public", allowed: status(200)},
  {method: "POST", route: "/api/burza", body: INVALID, guard: "user", allowed: status(400)},
  {method: "GET", route: "/api/burza/[id]", params: (i) => ({id: i.openAd}), guard: "public", allowed: status(200)},
  {method: "PATCH", route: "/api/burza/[id]", params: (i) => ({id: i.closedAd}), body: INVALID, guard: "user", allowed: status(400)},
  // Zatvori someone else's ad: the admin may (one already closed: nothing changes)
  {method: "PATCH", route: "/api/burza/[id]", note: "someone else's closed ad", params: (i) => ({id: i.closedAd}), body: {closed: true}, guard: "user", allowed: refused(403, "Možeš zatvoriti samo svoj oglas."), as: {admin: status(200)}},
  {method: "POST", route: "/api/burza/[id]/repost", params: (i) => ({id: i.closedAd}), body: INVALID, guard: "user", allowed: status(400)},
  // Objavi ponovno is the author's alone, the admin included
  {method: "POST", route: "/api/burza/[id]/repost", note: "someone else's closed ad", params: (i) => ({id: i.closedAd}), body: {}, guard: "user", allowed: refused(403, "Možeš ponovno objaviti samo svoj oglas.")},
  {method: "GET", route: "/api/burza/mine", guard: "user", allowed: status(200)},
  {method: "GET", route: "/api/burza/availability", guard: "user", allowed: status(200)},

  // ---------- the session itself, and the clock ----------
  {method: "POST", route: "/api/login", note: "nothing typed", body: INVALID, guard: "public", allowed: refused(400, "Upiši korisničko ime i lozinku.")},
  // ends this row's own session only (every test logs its roles in afresh)
  {method: "POST", route: "/api/logout", guard: "public", allowed: status(200)},
  {method: "POST", route: "/api/signup", body: INVALID, guard: "public", allowed: status(400)},
  // the scheduler's secret, not a role: no session gets in, the admin's neither
  {method: "GET", route: "/api/cron/tick", note: "without the scheduler's secret", guard: "cron", allowed: status(200)},
];

// Handlers with no row, and why
const UNCOVERED: Record<string, string> = {
  "GET /api/auth/[...nextauth]": "NextAuth's own (Google sign-in), no role; under next start without AUTH_TRUST_HOST every /api/auth/* answers 500 UntrustedHost",
  "POST /api/auth/[...nextauth]": "the same",
};

// A row's name says the route, whom its guard lets through, and which piece of the world it aims at
const title = (row: Row) => `${row.method} ${row.route} · ${guardLabel(row.guard)}${row.note ? ` · ${row.note}` : ""}`;
// the test of a bug's role alone
const bugTitle = (row: Row) => `${title(row)} · ${row.bug!.role}`;

type Fixtures = Parameters<Parameters<typeof test>[2]>[0];

// What the roles expect and what they got. Every call, the logins and the row's keep/restore happen here, before
// anything is asserted: test.fail() on a bug's test then covers the bug's wrong answer alone, and a failed login or a
// lost connection stays red.
async function answers(row: Row, roles: Role[], {api, db, ids}: Pick<Fixtures, "api" | "db" | "ids">) {
  const want: Record<string, unknown> = {};
  const got: Record<string, string> = {};
  const restore = await row.keep?.(db, ids);
  try {
    for (const role of roles) {
      const outcome = expected(row, role, ids.roleOf);
      if (outcome === SKIP) continue;
      want[role] = matcher(outcome);
      got[role] = describe(await call(await api(role), row, ids, ids.me[role]));
    }
  } finally {
    await restore?.();
  }
  return {want, got, url: urlOf(row, ids, ids.me.player)};
}

for (const row of ROWS) {
  // the roles the app answers as it should: an ordinary test, whatever a bug does to another role of the row
  test(title(row), async ({api, db, ids}) => {
    const {want, got, url} = await answers(row, ROLES.filter((role) => role !== row.bug?.role), {api, db, ids});
    expect(got, `${row.method} ${url}: what each role got`).toEqual(want);
  });
  if (row.bug) {
    const bug = row.bug;
    test(bugTitle(row), async ({api, db, ids}) => {
      const {want, got, url} = await answers(row, [bug.role], {api, db, ids});
      // BUG: the row's `bug` line: its Bela issue (#N) or the Bela commit that brings the fix, or Treseta's own bug
      test.fail(true, bug.text);
      expect(got, `${row.method} ${url}: what the ${bug.role} got`).toEqual(want);
    });
  }
}

test("/api/auth/me tells each role what the capability map lets it do", async ({api, ids}) => {
  for (const role of ["player", "organizer", "admin"] as const) {
    const res = await (await api(role)).get("/api/auth/me");
    expect(res.status(), role).toBe(200);
    const {user} = (await res.json()) as {user: {id: number; role: string; can: string[]}};
    expect({id: user.id, role: user.role, can: user.can}, role).toEqual({id: ids.me[role], role: ids.roleOf[role], can: capabilitiesOf({player_role: ids.roleOf[role]})});
  }
});

test("every handler of src/app/api has a row in the table, and every row a handler", () => {
  const handlers = appHandlers();
  const rows = new Set(ROWS.map((r) => `${r.method} ${r.route}`));
  expect(handlers.length, "the scan found no handlers").toBeGreaterThan(100);
  expect(handlers.filter((h) => !rows.has(h) && !(h in UNCOVERED)), "handlers without a row").toEqual([]);
  expect([...rows, ...Object.keys(UNCOVERED)].filter((r) => !handlers.includes(r)), "rows for no handler").toEqual([]);
  const titles = [...ROWS.map(title), ...ROWS.filter((r) => r.bug).map(bugTitle)];
  expect(titles.filter((t, n) => titles.indexOf(t) !== n), "rows with the same name").toEqual([]);
});
