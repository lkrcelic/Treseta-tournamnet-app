// C5 · a corrected match goes back in play (Treseta 467ea599): the admin changes a finished match on the phone so that
// its hands give no winner any more (nobody at 41 and ahead, or a "s ovim dosta" call that no longer stands), and the
// table is tonight's with nothing after it. Then the match is played again at its table, with its hands and the time
// it had left when it was closed; a closed table opens again, and the standings and ratings drop it until it closes.
// No question comes first: nothing is lost, the players go on. An empty next match that the closing opened is dropped.
// Each test plays its own one-table Kolo in "E2E · Novo kolo" (helpers/c5.ts); the `night` fixture removes it after.
// The rules (scoring.ts): a hand is 11 points; a match is won by the first team at 41 with more points; level at or
// above 41 plays on to 51; a team that called "s ovim dosta" wins once it reached the target with that hand.
import {
  customHand,
  deleteHand,
  expect,
  expectBoard,
  finishedNote,
  finishOpenMatch,
  matchTab,
  openAdminTable,
  ownTable,
  pickMatch,
  play,
  playedFor,
  ratingsOf,
  standingsOf,
  test,
  type OwnTable,
} from "../../helpers/c5";
import {correctHand, enterHand, escape, expectTotal, expectWins, finishMatch, handRows} from "../../helpers/scorepad";

test("the deciding hand of a closed table's last match deleted: the match is back in play with the time it had left, and the standings and ratings drop the table until it closes", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam} = table;
  const teams = [home.id, away.id];
  const standingsBefore = await standingsOf(db, night.league.id, teams);
  const ratingsBefore = await ratingsOf(db, [home, away]);

  // Meč 1 home's 41 : 14 (8 : 3 four times, 9 : 2); Meč 2 away's 14 : 41 (3 : 8 four times, 2 : 9): the table is 1 : 1
  await play(table, firstMatch, [[8, 3], [8, 3], [8, 3], [8, 3], [9, 2]]);
  const secondMatch = (await finishOpenMatch(night.admin, table.roundId))!;
  await play(table, secondMatch, [[3, 8], [3, 8], [3, 8], [3, 8], [2, 9]]);
  expect(await finishOpenMatch(night.admin, table.roundId)).toBeNull();
  const standingsClosed = await standingsOf(db, night.league.id, teams);
  const ratingsClosed = await ratingsOf(db, [home, away]);
  expect(standingsClosed).not.toEqual(standingsBefore);
  // Meč 2 took 20 of its 45 minutes before Završi meč: 25 are left
  const [meč1, meč2] = await db.match.findMany({where: {round_id: table.roundId}, orderBy: {id: "asc"}});
  await playedFor(db, meč2.id, 20);

  // the admin's phone: the closed table opens on Meč 2, away's 14 : 41
  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await expect(matchTab(page, 2)).toBeChecked();
  await expect(finishedNote(page)).toHaveText("Runda je završena. Izmjene mijenjaju rezultat i poredak.");
  await expectBoard(page, {[home.name]: 14, [away.name]: 41}, 5);

  // Obriši igru 5: 12 : 32, nobody at 41, and nothing came after it: no question, Meč 2 is played again
  await deleteHand(page, 5);
  await expect(matchTab(page, 2)).toHaveAccessibleName(/^Meč 2\s*u tijeku$/);
  await expect(finishedNote(page)).toBeHidden();
  await expect(page.getByRole("button", {name: "Upiši igru", exact: true})).toBeVisible();
  await expectBoard(page, {[home.name]: 12, [away.name]: 32}, 4);
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await healthy(page);

  // the table is open again, Meč 1 home's and Meč 2 in play with its four hands and 25 minutes left
  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: true, ongoingMatches: {include: {results: true}}}});
  expect([round.open, round.active, ...byTeam(round.team1_wins, round.team2_wins)]).toEqual([true, true, 1, 0]);
  expect(round.matches.map((m) => [m.id, ...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side])).toEqual([[meč1.id, 41, 14, table.homeSide]]);
  expect(round.ongoingMatches).toHaveLength(1);
  const reopened = round.ongoingMatches[0];
  expect(byTeam(reopened.player_pair1_score, reopened.player_pair2_score)).toEqual([12, 32]);
  expect(reopened.results).toHaveLength(4);
  const left = (reopened.ends_at!.getTime() - Date.now()) / 60_000;
  expect(left, `${left} minutes left`).toBeGreaterThan(24);
  expect(left).toBeLessThanOrEqual(25.1);
  // until it closes the table counts nowhere: the standings and the ratings are as before it was played
  expect(await standingsOf(db, night.league.id, teams)).toEqual(standingsBefore);
  expect(await ratingsOf(db, [home, away])).toEqual(ratingsBefore);

  // the players go on: Početna's Nastavi igru, the board with the four hands and the time left
  const phone = await as(table.phone);
  await phone.goto("/");
  await phone.getByRole("button", {name: new RegExp(`^STOL 1 .*${escape(home.name)}.*Nastavi igru$`)}).click();
  await expect(phone).toHaveURL(new RegExp(`/ongoing-match/${reopened.id}$`));
  await expect(phone.getByText("Meč 2 od 2")).toBeVisible();
  await expect(handRows(phone)).toHaveCount(4);
  await expectTotal(phone, home.name, 12);
  await expectTotal(phone, away.name, 32);
  await expect(phone.getByRole("timer", {name: /^Do kraja partije 2[45]:\d\d$/})).toBeVisible();

  // away's 9 again: 14 : 41, Završi meč, Kraj kola, and the table counts as before (1 : 1)
  await enterHand(phone, {team: away.name, points: 9});
  await expect(phone.getByText(`${away.name}: 41 bod, pobjeda`)).toBeVisible();
  expect(await finishMatch(phone)).toBe("end");
  const closed = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: {orderBy: {id: "asc"}}}});
  expect([closed.open, ...byTeam(closed.team1_wins, closed.team2_wins)]).toEqual([false, 1, 1]);
  expect(closed.matches.map((m) => byTeam(m.player_pair1_score, m.player_pair2_score))).toEqual([
    [41, 14],
    [14, 41],
  ]);
  expect(await standingsOf(db, night.league.id, teams)).toEqual(standingsClosed);
  expect(await ratingsOf(db, [home, away])).toEqual(ratingsClosed);
  await healthy(phone);
});

test("Meč 1 corrected on the keypad while Meč 2 has no hand: Meč 1 is played again and the empty Meč 2 is dropped", async ({as, api, db, night, healthy}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam} = table;
  // Meč 1 home's 41 : 14; Završi meč opened Meč 2, where nothing is entered yet
  await play(table, firstMatch, [[8, 3], [8, 3], [8, 3], [8, 3], [9, 2]]);
  const secondMatch = (await finishOpenMatch(night.admin, table.roundId))!;

  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await expect(matchTab(page, 2)).toBeChecked();
  await pickMatch(page, 1);
  await expect(finishedNote(page)).toHaveText("Meč 1 je završen. Izmjene mijenjaju rezultat i poredak.");
  await expectBoard(page, {[home.name]: 41, [away.name]: 14}, 5);
  await expectWins(page, home.name, 1);

  // Igra 5 was home's 9 : 2; corrected on the keypad to home's 2 (away 9): 34 : 21, nobody at 41
  await correctHand(page, 5, {team: home.name, points: 2});
  await expect(page).toHaveURL(/[?&]mec=1(&|$)/);
  await expectBoard(page, {[home.name]: 34, [away.name]: 21}, 5);
  // Meč 1 in play: no finished match, so no Meč 1 · Meč 2 and no note, and the next hand can be entered
  await expect(page.getByRole("radiogroup", {name: "Meč"})).toBeHidden();
  await expect(finishedNote(page)).toBeHidden();
  await expect(page.getByRole("button", {name: "Upiši igru", exact: true})).toBeVisible();
  await expectWins(page, home.name, 0);
  await expectWins(page, away.name, 0);
  await healthy(page);

  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: true, ongoingMatches: {include: {results: {orderBy: {result_id: "asc"}}}}}});
  expect([round.open, round.team1_wins, round.team2_wins, round.matches.length]).toEqual([true, 0, 0, 0]);
  // one match in play, Meč 1 with its five hands; the empty Meč 2 is gone
  expect(round.ongoingMatches).toHaveLength(1);
  const [meč1] = round.ongoingMatches;
  expect(meč1.id).not.toBe(secondMatch);
  expect(byTeam(meč1.player_pair1_score, meč1.player_pair2_score)).toEqual([34, 21]);
  expect(meč1.results.map((r) => byTeam(r.team1_game_points, r.team2_game_points))).toEqual([[8, 3], [8, 3], [8, 3], [8, 3], [2, 9]]);
  expect(await db.ongoingMatch.count({where: {id: secondMatch}})).toBe(0);
});

// Meč 1 won by home's "s ovim dosta" with fewer points: 33 : 33 after six hands, Ručno 2 : 5 (35 : 38), then Ručno
// 6 : 5 with home's call: 41 : 43, home reached 41 with the hand that called it
const dostaWin = (table: OwnTable, matchId: number) =>
  play(table, matchId, [
    [8, 3],
    [3, 8],
    [8, 3],
    [3, 8],
    [6, 5],
    [5, 6],
    {points: [2, 5], custom: true},
    {points: [6, 5], custom: true, dosta: "home"},
  ]);

test('a "s ovim dosta" win whose calling hand is corrected below 41: the call no longer stands and the match is played again', async ({as, api, db, night, healthy}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam, homeSide} = table;
  await dostaWin(table, firstMatch);
  await finishOpenMatch(night.admin, table.roundId);
  const won = await db.match.findFirstOrThrow({where: {round_id: table.roundId}});
  expect([...byTeam(won.player_pair1_score, won.player_pair2_score), won.winner_side]).toEqual([41, 43, homeSide]);

  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await pickMatch(page, 1);
  await expectBoard(page, {[home.name]: 41, [away.name]: 43}, 8);
  await expectWins(page, home.name, 1);

  // Custom on Igra 8: 3 : 2 instead of 6 : 5 → 38 : 40. Home no longer reached 41 with it, so there is no call and no
  // winner: Meč 1 is played again, and nothing is asked (no team reached 41 with that hand)
  await customHand(page, 8, {[home.name]: 3, [away.name]: 2});
  await expectBoard(page, {[home.name]: 38, [away.name]: 40}, 8);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("radiogroup", {name: "Meč"})).toBeHidden();
  await expect(page.getByRole("button", {name: "Upiši igru", exact: true})).toBeVisible();
  await expectWins(page, home.name, 0);
  await healthy(page);

  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: true, ongoingMatches: {include: {results: {orderBy: {result_id: "asc"}}}}}});
  expect([round.open, round.team1_wins, round.team2_wins, round.matches.length, round.ongoingMatches.length]).toEqual([true, 0, 0, 0, 1]);
  const last = round.ongoingMatches[0].results.at(-1)!;
  expect([...byTeam(last.team1_game_points, last.team2_game_points), last.custom, last.dosta_side]).toEqual([3, 2, true, null]);
  expect(byTeam(round.ongoingMatches[0].player_pair1_score, round.ongoingMatches[0].player_pair2_score)).toEqual([38, 40]);
});

// The reopened match's hands have new ids (467ea599), so the question finds the corrected hand by its place
// (dostaAskHand; Treseta #1, ea1458ba). Before, the board went straight to "Do 51".
test('a "s ovim dosta" win corrected to 41 : 41 is played again to 51, and the admin is asked "s ovim dosta" as after any custom hand', async ({as, api, db, night, healthy}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam} = table;
  await dostaWin(table, firstMatch);
  await finishOpenMatch(night.admin, table.roundId);

  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await pickMatch(page, 1);
  await expectBoard(page, {[home.name]: 41, [away.name]: 43}, 8);

  // Custom on Igra 8: 6 : 3 without the call → 41 : 41, level at the target: no winner, Meč 1 is played again to 51.
  // Both teams reached 41 with that custom hand, so the board asks who called, as it does after every custom hand.
  await customHand(page, 8, {[home.name]: 6, [away.name]: 3});
  const question = page.getByRole("dialog", {name: "Je li netko zvao „s ovim dosta”?"});
  await expect(question).toBeVisible();
  await question.getByRole("button", {name: "Ne, nitko nije zvao", exact: true}).click();
  await expect(question).toBeHidden();
  await expect(page.getByRole("status", {name: "Izjednačeno, igra se do 51"})).toBeVisible();
  await expectBoard(page, {[home.name]: 41, [away.name]: 41}, 8);
  await expect(page.getByRole("button", {name: "Upiši igru", exact: true})).toBeVisible();
  await healthy(page);

  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: true, ongoingMatches: {include: {results: {orderBy: {result_id: "asc"}}}}}});
  expect([round.open, round.matches.length, round.ongoingMatches.length]).toEqual([true, 0, 1]);
  const last = round.ongoingMatches[0].results.at(-1)!;
  expect([...byTeam(last.team1_game_points, last.team2_game_points), last.dosta_side]).toEqual([6, 3, null]);
});
