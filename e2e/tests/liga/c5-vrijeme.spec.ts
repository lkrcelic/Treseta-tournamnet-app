// C5 · a match closed by Vrijeme partije, corrected by the admin (Treseta 467ea599): when the time ran out the team
// with more points won, so after a change it goes to the team with more points again: the win moves without a
// question, and a level score leaves it without a winner, asked first ("Meč ostaje bez pobjednika?"). Such a match is
// never played again ("s ovim dosta" isn't called once the time is up), even with its next match still empty.
// The test plays its own one-table Kolo in "E2E · Novo kolo" (helpers/c5.ts) and lets the time run out by moving the
// match's deadline back and calling /api/cron/tick, as the scheduler does; the `night` fixture removes it afterwards.
import {CRON_HEADERS} from "../../helpers/db";
import {customHand, expect, expectBoard, finishedNote, matchTab, noWinnerSheet, openAdminTable, ownTable, pickMatch, play, test} from "../../helpers/c5";
import {correctHand, expectWins} from "../../helpers/scorepad";

test("a match closed by Vrijeme partije goes to the team with more points after a correction, and a level score is asked first and left without a winner", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, away, byTeam, homeSide, awaySide} = table;
  // Meč 1: 6 : 5, 7 : 4, 8 : 3, 5 : 6 → home 26 : 18, nobody at 41, when its 45 minutes run out
  await play(table, firstMatch, [[6, 5], [7, 4], [8, 3], [5, 6]]);
  await db.ongoingMatch.update({where: {id: firstMatch}, data: {started_at: new Date(Date.now() - 46 * 60_000), ends_at: new Date(Date.now() - 60_000)}});
  const tick = await night.admin.get("/api/cron/tick", {headers: CRON_HEADERS});
  expect(tick.ok(), `tick: ${await tick.text()}`).toBeTruthy();
  const closed = await db.match.findFirstOrThrow({where: {round_id: table.roundId}});
  expect([...byTeam(closed.player_pair1_score, closed.player_pair2_score), closed.winner_side, closed.time_expired]).toEqual([26, 18, homeSide, true]);
  // the time closed it, so Meč 2 is open and empty
  const secondMatch = (await db.ongoingMatch.findFirstOrThrow({where: {round_id: table.roundId}})).id;

  const page = await as("admin");
  await openAdminTable(page, night.league.id, table.roundId);
  await pickMatch(page, 1);
  await expectBoard(page, {[home.name]: 26, [away.name]: 18}, 4);
  await expectWins(page, home.name, 1);

  // Igra 1 corrected on the keypad to home's 1 (away 10): 21 : 23, away has more, so Meč 1 is away's, asked nothing
  await correctHand(page, 1, {team: home.name, points: 1});
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(matchTab(page, 1)).toBeChecked();
  await expect(finishedNote(page)).toHaveText("Meč 1 je završen. Izmjene mijenjaju rezultat i poredak.");
  await expectBoard(page, {[home.name]: 21, [away.name]: 23}, 4);
  await expectWins(page, home.name, 0);
  await expectWins(page, away.name, 1);
  let round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: true, ongoingMatches: {include: {results: true}}}});
  expect(round.matches.map((m) => [...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side, m.time_expired])).toEqual([[21, 23, awaySide, true]]);
  expect(byTeam(round.team1_wins, round.team2_wins)).toEqual([0, 1]);
  expect(round.ongoingMatches.map((m) => [m.id, m.results.length])).toEqual([[secondMatch, 0]]);

  // Igra 2 (7 : 4) made Custom 8 : 3: 22 : 22, level, so nobody has won: asked first, then left without a winner
  await customHand(page, 2, {[home.name]: 8, [away.name]: 3});
  const warning = noWinnerSheet(page);
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Nakon ove promjene meč je 22:22, pa se ne broji nijednoj ekipi.");
  await warning.getByRole("button", {name: "Spremi svejedno"}).click();
  await expect(warning).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(matchTab(page, 1)).toHaveAccessibleName(/^Meč 1\s*22 : 22 · završen$/);
  await expectBoard(page, {[home.name]: 22, [away.name]: 22}, 4);
  await expectWins(page, home.name, 0);
  await expectWins(page, away.name, 0);
  await healthy(page);

  // still finished (not played again), without a winner; Meč 2 as it was
  round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: true, ongoingMatches: {include: {results: true}}}});
  expect(round.matches.map((m) => [m.id, m.player_pair1_score, m.player_pair2_score, m.winner_side, m.time_expired])).toEqual([[closed.id, 22, 22, null, true]]);
  expect([round.open, round.team1_wins, round.team2_wins]).toEqual([true, 0, 0]);
  expect(round.ongoingMatches.map((m) => [m.id, m.results.length])).toEqual([[secondMatch, 0]]);
});
