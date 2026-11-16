// C5 · a corrected match that can't go back in play (Treseta 467ea599): when the admin's change leaves a finished
// match without a winner but something came after it at its table or in its league (a later match with a hand, the
// next Kolo, even a Skica), or the table isn't tonight's, or the match had no time left when it was closed, the admin's
// phone asks "Meč ostaje bez pobjednika?" first, and the warning says why the match can't be played again. Odustani
// saves nothing; Obriši svejedno leaves the match without a winner (it counts for neither team) and recounts the table
// and the standings.
// Tables of the test's own are a one-table Kolo in "E2E · Novo kolo" (helpers/c5.ts), removed after each test; the
// seeded ones (tables.adminEdit, a table of last week) are only looked at: Odustani leaves them as they were.
// The rules (scoring.ts): a hand is 11 points; a match is won by the first team at 41 with more points; level at or
// above 41 plays on to 51. A table of 1 : 0 is still a win (2 points in the standings, a draw 1).
import {
  cancelNoWinner,
  deleteHand,
  expect,
  expectBoard,
  finishedMatches,
  finishedNote,
  finishOpenMatch,
  matchTab,
  nextSkica,
  noWinnerSheet,
  openAdminTable,
  ownTable,
  pickMatch,
  play,
  playedFor,
  replay,
  standingsOf,
  test,
} from "../../helpers/c5";
import {enterHand, escape, expectWins, handRows} from "../../helpers/scorepad";

// the warning's sentence: the score after the change, the target nobody has, and why the match stays closed
const cantReopen = (score: [number, number], target: number, why: string) =>
  new RegExp(`Nakon ove promjene meč je ${score[0]}:${score[1]} i nitko nema ${target}\\. ${escape(why)}, pa se ne može ponovno otvoriti igračima`);

test("the next match already has a hand: Meč 1 can't be played again, the warning says so, and Obriši svejedno leaves it without a winner", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam, bySide} = table;
  // Meč 1 home's 41 : 14; Meč 2 has started: 6 : 5
  await play(table, firstMatch, [[8, 3], [8, 3], [8, 3], [8, 3], [9, 2]]);
  const secondMatch = (await finishOpenMatch(night.admin, table.roundId))!;
  await play(table, secondMatch, [[6, 5]]);

  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await expect(matchTab(page, 2)).toBeChecked();
  await pickMatch(page, 1);
  await expectBoard(page, {[home.name]: 41, [away.name]: 14}, 5);

  // Obriši igru 5: 32 : 12, nobody at 41, and Meč 2 is being played
  await deleteHand(page, 5);
  const warning = noWinnerSheet(page);
  await expect(warning).toBeVisible();
  await expect(warning).toContainText(cantReopen(bySide(32, 12), 41, "Za stolom se već igra sljedeći meč"));
  await warning.getByRole("button", {name: "Obriši svejedno"}).click();
  await expect(warning).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Meč 1 stays finished, 32 : 12 without a winner: no pip for anyone, and Meč 2 goes on
  await expect(matchTab(page, 1)).toBeChecked();
  await expect(matchTab(page, 1)).toHaveAccessibleName(new RegExp(`^Meč 1\\s*${bySide(32, 12).join(" : ")} · završen$`));
  await expect(finishedNote(page)).toHaveText("Meč 1 je završen. Izmjene mijenjaju rezultat i poredak.");
  await expectBoard(page, {[home.name]: 32, [away.name]: 12}, 4);
  await expectWins(page, home.name, 0);
  await expectWins(page, away.name, 0);
  await healthy(page);

  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: {include: {results: true}}, ongoingMatches: {include: {results: true}}}});
  expect([round.open, round.team1_wins, round.team2_wins]).toEqual([true, 0, 0]);
  expect(round.matches.map((m) => [...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side, m.results.length])).toEqual([[32, 12, null, 4]]);
  expect(round.ongoingMatches.map((m) => [m.id, m.results.length])).toEqual([[secondMatch, 1]]);
});

// The warning tells the admin to add the hands that were played, and the phone adds them as the computer does
// (c5-ispravak.racunalo.spec.ts): Upiši igru and Custom on a finished match too, decided 16.11. (6333400c). Before, the
// phone had them only on the match being played.
test("a match left without a winner on the phone gets the hand that was played added again, and its winner back, as the warning says", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam, bySide, homeSide} = table;
  // Meč 1 home's 41 : 14; Meč 2 has started, so Meč 1 can't be played again
  await play(table, firstMatch, [[8, 3], [8, 3], [8, 3], [8, 3], [9, 2]]);
  const secondMatch = (await finishOpenMatch(night.admin, table.roundId))!;
  await play(table, secondMatch, [[6, 5]]);

  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await pickMatch(page, 1);
  // Obriši igru 5 → 32 : 12, Obriši svejedno: Meč 1 without a winner
  await deleteHand(page, 5);
  await noWinnerSheet(page).getByRole("button", {name: "Obriši svejedno"}).click();
  await expect(noWinnerSheet(page)).toBeHidden();
  await expectBoard(page, {[home.name]: 32, [away.name]: 12}, 4);

  // the hand that was played, home's 9 : 2, added to the finished Meč 1: 41 : 14 and home's again, asked nothing
  const row = await enterHand(page, {team: home.name, points: 9});
  await expect(row).toHaveAccessibleName(new RegExp(`^Igra 5: ${bySide(9, 2).join(" prema ")}, ukupno ${bySide(41, 14).join(" prema ")}, `));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(matchTab(page, 1)).toBeChecked();
  await expect(finishedNote(page)).toHaveText("Meč 1 je završen. Izmjene mijenjaju rezultat i poredak.");
  await expectBoard(page, {[home.name]: 41, [away.name]: 14}, 5);
  await expectWins(page, home.name, 1);
  await healthy(page);

  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: {include: {results: true}}, ongoingMatches: {include: {results: true}}}});
  expect(round.matches.map((m) => [...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side, m.results.length])).toEqual([[41, 14, homeSide, 5]]);
  expect([round.open, ...byTeam(round.team1_wins, round.team2_wins)]).toEqual([true, 1, 0]);
  expect(round.ongoingMatches.map((m) => [m.id, m.results.length])).toEqual([[secondMatch, 1]]);
});

test("a closed table's last match without time left, then with the next Kolo made: each warning says why, and Obriši svejedno recounts the table and the standings", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam, bySide} = table;
  const teams = [home.id, away.id];
  // Meč 1 home's 41 : 14, Meč 2 away's 14 : 41: the table is 1 : 1, a draw
  await play(table, firstMatch, [[8, 3], [8, 3], [8, 3], [8, 3], [9, 2]]);
  const secondMatch = (await finishOpenMatch(night.admin, table.roundId))!;
  await play(table, secondMatch, [[3, 8], [3, 8], [3, 8], [3, 8], [2, 9]]);
  expect(await finishOpenMatch(night.admin, table.roundId)).toBeNull();
  const drawn = await standingsOf(db, night.league.id, teams);
  const matches = await finishedMatches(db, table.roundId);
  const meč2 = matches[1].id;
  // Meč 2 went on for 50 minutes: its 45 were used up when it was closed
  await playedFor(db, meč2, 50);

  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await expect(matchTab(page, 2)).toBeChecked();
  await expectBoard(page, {[home.name]: 14, [away.name]: 41}, 5);

  // Obriši igru 5 → 12 : 32: no time left to play it again; Odustani saves nothing
  await deleteHand(page, 5);
  await expect(noWinnerSheet(page)).toContainText(cantReopen(bySide(12, 32), 41, "Meču je vrijeme već isteklo"));
  await cancelNoWinner(page);
  await expectBoard(page, {[home.name]: 14, [away.name]: 41}, 5);
  expect(await finishedMatches(db, table.roundId)).toEqual(matches);

  // Meč 2 took 10 minutes after all, but the next Kolo is made (a Skica of Novo kolo): still no going back
  await playedFor(db, meč2, 10);
  await nextSkica(night.admin, night.league.id, teams);
  await deleteHand(page, 5);
  const warning = noWinnerSheet(page);
  await expect(warning).toContainText(cantReopen(bySide(12, 32), 41, "Sljedeće kolo je već složeno"));
  await warning.getByRole("button", {name: "Obriši svejedno"}).click();
  await expect(warning).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Meč 2 stays finished at 12 : 32 without a winner: the closed table is 1 : 0, home's win
  await expect(matchTab(page, 2)).toHaveAccessibleName(new RegExp(`^Meč 2\\s*${bySide(12, 32).join(" : ")} · završen$`));
  await expect(finishedNote(page)).toHaveText("Runda je završena. Izmjene mijenjaju rezultat i poredak.");
  await expectBoard(page, {[home.name]: 12, [away.name]: 32}, 4);
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);
  await healthy(page);

  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: {orderBy: {id: "asc"}}, ongoingMatches: true}});
  expect([round.open, ...byTeam(round.team1_wins, round.team2_wins), round.ongoingMatches.length]).toEqual([false, 1, 0, 0]);
  expect(round.matches.map((m) => [...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side])).toEqual([
    [41, 14, table.homeSide],
    [12, 32, null],
  ]);
  // the standings: the draw became home's win (2 points, not 1), and Meč 2's points moved by 7 for home
  const won = await standingsOf(db, night.league.id, teams);
  const moved = won.map((row, i) => ({
    team_id: row.team_id,
    wins: row.wins - drawn[i].wins,
    draws: row.draws - drawn[i].draws,
    losses: row.losses - drawn[i].losses,
    score: row.score - drawn[i].score,
    point_difference: row.point_difference - drawn[i].point_difference,
  }));
  expect(moved).toEqual(
    [
      {team_id: home.id, wins: 1, draws: -1, losses: 0, score: 1, point_difference: 7},
      {team_id: away.id, wins: 0, draws: -1, losses: 1, score: -1, point_difference: -7},
    ].sort((a, b) => a.team_id - b.team_id),
  );
});

test("tables.adminEdit: Meč 1 can't be played again once Meč 2 was played; the warning says so, and Odustani changes nothing", async ({as, db, world, healthy}) => {
  const {roundId} = world.tables.adminEdit;
  const leagueId = world.leagues.scorepad.id;
  const round = await db.round.findUniqueOrThrow({where: {id: roundId}, include: {team1: true, team2: true}});
  const before = await finishedMatches(db, roundId);
  expect(before).toHaveLength(2);
  expect(before.every((m) => m.winner_side != null)).toBe(true);
  // Meč 1 without its last hand: the hand that decided it, so nobody has won (the seed stopped at the first winner)
  const meč1 = before[0];
  const n = meč1.results.length;
  const after = replay(meč1.results.slice(0, -1));
  expect(after.winner).toBeNull();

  const page = await as("admin");
  await openAdminTable(page, leagueId, roundId);
  await expect(matchTab(page, 2)).toBeChecked();
  await pickMatch(page, 1);
  await expect(finishedNote(page)).toHaveText("Runda je završena. Izmjene mijenjaju rezultat i poredak.");
  await expectBoard(page, {[round.team1.team_name]: meč1.player_pair1_score, [round.team2.team_name]: meč1.player_pair2_score}, n);

  await deleteHand(page, n);
  await expect(noWinnerSheet(page)).toContainText(cantReopen([after.score1, after.score2], after.target, "Za stolom je već odigran sljedeći meč"));
  await cancelNoWinner(page);
  await expectBoard(page, {[round.team1.team_name]: meč1.player_pair1_score, [round.team2.team_name]: meč1.player_pair2_score}, n);
  await healthy(page);
  expect(await finishedMatches(db, roundId)).toEqual(before);
  expect(await db.round.findUniqueOrThrow({where: {id: roundId}})).toMatchObject({open: false, team1_wins: round.team1_wins, team2_wins: round.team2_wins});
});

test("a table of last week: its match can't be played again tonight, the warning says so, and Odustani changes nothing", async ({as, db, world, healthy}) => {
  const leagueId = world.leagues.scorepad.id;
  // E2E · Scorepad's last Kolo of a week ago, table 1
  const lastWeek = new Date(new Date(`${world.leagues.scorepad.tonight!}T00:00:00Z`).getTime() - 7 * 86_400_000);
  const round = await db.round.findFirstOrThrow({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_date: lastWeek, table_number: 1},
    orderBy: {round_number: "desc"},
    include: {team1: true, team2: true},
  });
  const before = await finishedMatches(db, round.id);
  expect(before).toHaveLength(2);
  // Meč 2 without its last hand, the one that decided it
  const meč2 = before[1];
  const n = meč2.results.length;
  const after = replay(meč2.results.slice(0, -1));
  expect(after.winner).toBeNull();

  const page = await as("admin");
  await openAdminTable(page, leagueId, round.id);
  await expect(matchTab(page, 2)).toBeChecked();
  await expect(handRows(page)).toHaveCount(n);
  await deleteHand(page, n);
  await expect(noWinnerSheet(page)).toContainText(cantReopen([after.score1, after.score2], after.target, "Stol nije od večeras"));
  await cancelNoWinner(page);
  await expectBoard(page, {[round.team1.team_name]: meč2.player_pair1_score, [round.team2.team_name]: meč2.player_pair2_score}, n);
  await healthy(page);
  expect(await finishedMatches(db, round.id)).toEqual(before);
});
