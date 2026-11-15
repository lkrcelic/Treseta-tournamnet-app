// C5 · the admin's scorepad on the computer, where a finished match also takes a new hand (the phone corrects and
// deletes a finished match's hands, but adds hands only to the match being played):
//   - a match that can't go back in play is left without a winner (the dialog "Meč ostaje bez pobjednika?" first), and
//     the hand that was played, added again, gives it its winner back, as the warning tells the admin to do;
//   - tables.adminEdit (league "E2E · Scorepad"): a hand added to its last match for the team that won it keeps the
//     win, and deleting it again puts the table back as the seed left it (the test also cleans up if it fails between).
// The rules (scoring.ts): a hand is 11 points, typed for one team, the other gets the rest; a match is won by the
// first team at 41 with more points.
import {
  desktopHand,
  desktopMatch,
  entryPanel,
  expect,
  finishedMatches,
  finishOpenMatch,
  openDesktopTable,
  ownTable,
  play,
  replay,
  standingsOf,
  test,
} from "../../helpers/c5";
import {handRow, handRows} from "../../helpers/scorepad";

test("a match left without a winner on the computer gets the hand that was played added again, and its winner back", async ({as, api, db, night, healthy}) => {
  const {table, firstMatch} = await ownTable(night, db, api);
  const {home, byTeam, bySide, homeSide} = table;
  // Meč 1 home's 41 : 14; Meč 2 has started, so Meč 1 can't be played again
  await play(table, firstMatch, [[8, 3], [8, 3], [8, 3], [8, 3], [9, 2]]);
  const secondMatch = (await finishOpenMatch(night.admin, table.roundId))!;
  await play(table, secondMatch, [[6, 5]]);

  const page = await as("admin");
  await openDesktopTable(page, night.league.id, table.roundId);
  await desktopMatch(page, 1).click();
  await expect(desktopMatch(page, 1)).toHaveAttribute("aria-pressed", "true");
  await expect(desktopMatch(page, 1)).toHaveAccessibleName(`Meč 1 · ${bySide(41, 14).join(" : ")} Pobjeda: ${home.name}`);
  await expect(handRows(page)).toHaveCount(5);

  // Igra 5 opened in the panel and deleted: 32 : 12, asked first, Obriši svejedno
  await handRow(page, 5).click();
  await expect(entryPanel(page)).toHaveAccessibleName("Uredi igru 5");
  await entryPanel(page).getByRole("button", {name: "Obriši igru"}).click();
  const warning = page.getByRole("dialog", {name: "Meč ostaje bez pobjednika?"});
  await expect(warning).toContainText(
    new RegExp(`Nakon ove promjene meč je ${bySide(32, 12).join(":")} i nitko nema 41\\. Za stolom se već igra sljedeći meč, pa se ne može ponovno otvoriti igračima: ostaje bez pobjednika dok ne dopišeš igre koje su odigrane\\.`),
  );
  await warning.getByRole("button", {name: "Obriši svejedno"}).click();
  await expect(warning).toBeHidden();
  await expect(desktopMatch(page, 1)).toHaveAccessibleName(`Meč 1 · ${bySide(32, 12).join(" : ")} Bez pobjednika`);
  await expect(handRows(page)).toHaveCount(4);

  // the hand that was played, home's 9 : 2, added to the finished Meč 1: 41 : 14 and home's again, asked nothing
  await expect(entryPanel(page)).toHaveAccessibleName("Igra 5");
  await desktopHand(page, home.name, 9);
  await expect(desktopMatch(page, 1)).toHaveAccessibleName(`Meč 1 · ${bySide(41, 14).join(" : ")} Pobjeda: ${home.name}`);
  await expect(handRows(page)).toHaveCount(5);
  await expect(handRow(page, 5)).toHaveAccessibleName(new RegExp(`^Igra 5: ${bySide(9, 2).join(" prema ")}, ukupno ${bySide(41, 14).join(" prema ")}, `));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await healthy(page);

  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: {include: {results: true}}, ongoingMatches: {include: {results: true}}}});
  expect(round.matches.map((m) => [...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side, m.results.length])).toEqual([[41, 14, homeSide, 5]]);
  expect([round.open, ...byTeam(round.team1_wins, round.team2_wins)]).toEqual([true, 1, 0]);
  expect(round.ongoingMatches.map((m) => [m.id, m.results.length])).toEqual([[secondMatch, 1]]);
});

test("tables.adminEdit on the computer: a hand added to the last match for its winner keeps the win and moves the score, and deleting it puts the table back", async ({
  as,
  api,
  db,
  world,
  healthy,
}) => {
  const {roundId} = world.tables.adminEdit;
  const leagueId = world.leagues.scorepad.id;
  const round = await db.round.findUniqueOrThrow({where: {id: roundId}, include: {team1: true, team2: true}});
  const names = [round.team1.team_name, round.team2.team_name] as const;
  const before = await finishedMatches(db, roundId);
  const standingsBefore = await standingsOf(db, leagueId, [round.team1_id, round.team2_id]);
  const seeded = new Set(before.flatMap((m) => m.results.map((r) => r.result_id)));
  expect(before).toHaveLength(2);
  const meč2 = before[1];
  const winner = meč2.winner_side as 1 | 2;
  expect(replay(meč2.results).winner).toBe(winner);
  const score = [meč2.player_pair1_score, meč2.player_pair2_score];
  const n = meč2.results.length;
  // the winner's 11 (Kaput, 11 : 0) on top
  const added = winner === 1 ? [score[0] + 11, score[1]] : [score[0], score[1] + 11];
  const admin = await api("admin");

  try {
    const page = await as("admin");
    await openDesktopTable(page, leagueId, roundId);
    await expect(page.getByText("Runda je završena. Izmjene mijenjaju rezultat i poredak.")).toBeVisible();
    // the closed table shows its last match
    await expect(desktopMatch(page, 2)).toHaveAttribute("aria-pressed", "true");
    await expect(desktopMatch(page, 2)).toHaveAccessibleName(`Meč 2 · ${score.join(" : ")} Pobjeda: ${names[winner - 1]}`);
    await expect(handRows(page)).toHaveCount(n);

    await expect(entryPanel(page)).toHaveAccessibleName(`Igra ${n + 1}`);
    await desktopHand(page, names[winner - 1], 11);
    await expect(handRows(page)).toHaveCount(n + 1);
    await expect(desktopMatch(page, 2)).toHaveAccessibleName(`Meč 2 · ${added.join(" : ")} Pobjeda: ${names[winner - 1]}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    let stored = await finishedMatches(db, roundId);
    expect(stored.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side, m.results.length])).toEqual([
      [before[0].player_pair1_score, before[0].player_pair2_score, before[0].winner_side, before[0].results.length],
      [added[0], added[1], winner, n + 1],
    ]);
    // the table's result stands; the standings' point difference moved by the 11
    expect(await db.round.findUniqueOrThrow({where: {id: roundId}})).toMatchObject({open: false, team1_wins: round.team1_wins, team2_wins: round.team2_wins});
    const standingsAdded = await standingsOf(db, leagueId, [round.team1_id, round.team2_id]);
    const winnerId = winner === 1 ? round.team1_id : round.team2_id;
    expect(standingsAdded.map((s, i) => s.point_difference - standingsBefore[i].point_difference)).toEqual(standingsAdded.map((s) => (s.team_id === winnerId ? 11 : -11)));

    // the added hand opened and deleted: the winner keeps the match, nothing is asked, and the table is as before
    await handRow(page, n + 1).click();
    await expect(entryPanel(page)).toHaveAccessibleName(`Uredi igru ${n + 1}`);
    await entryPanel(page).getByRole("button", {name: "Obriši igru"}).click();
    await expect(handRows(page)).toHaveCount(n);
    await expect(desktopMatch(page, 2)).toHaveAccessibleName(`Meč 2 · ${score.join(" : ")} Pobjeda: ${names[winner - 1]}`);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await healthy(page);
    stored = await finishedMatches(db, roundId);
    expect(stored).toEqual(before);
    expect(await standingsOf(db, leagueId, [round.team1_id, round.team2_id])).toEqual(standingsBefore);
  } finally {
    // a hand this test added and didn't get to delete
    const extra = await db.result.findMany({where: {match: {round_id: roundId}, result_id: {notIn: [...seeded]}}});
    for (const r of extra) {
      const res = await admin.delete(`/api/admin/hands/finished/${r.result_id}`);
      expect(res.ok(), `clean up hand ${r.result_id}: ${await res.text()}`).toBeTruthy();
    }
  }
});
