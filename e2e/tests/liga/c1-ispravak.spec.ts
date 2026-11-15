// C1 · correcting a saved hand on the phone (Bela 1bb39ea: for a week every correction ended in "Igra nije
// spremljena."): a tap on the hand, its steps again (Zvanja, Igra; a custom hand opens on Igra with Ručno on), Spremi.
// The hand is changed in place: the list, the score and the database show it, and there is still one hand, not two.
// Once on a table of the test's own Kolo in "E2E · Novo kolo", once on tables.correction (league "E2E · Scorepad",
// the first match with 4 hands), whose hands the `correction` fixture puts back afterwards.
// A hand's total is its points and its zvanja (3 and 4 each); a normal hand's points are 11 between the teams.
import {expect, pickTeams, sidesOf, test} from "../../helpers/c1";
import {addHands, correctHand, expectTotal, handRow, handRows, publishTable, startMatch, type SavedHand} from "../../helpers/scorepad";

test("a corrected hand is still one hand, with the new points and zvanja in the list, the score and the database", async ({as, api, db, night, healthy}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide, awaySide} = sidesOf(table, home);
  const matchId = await startMatch(night.admin, table.roundId);
  // four hands from a teammate's phone (home : away): 6 : 5, 3 : 8 with away's 3 (3 : 11), 7 : 4, Ručno 4 : 3
  await addHands(await api(phone), matchId, [
    {points: bySide(6, 5)},
    {points: bySide(3, 8), zvanja: {[awaySide]: [3]}},
    {points: bySide(7, 4)},
    {points: bySide(4, 3), custom: true},
  ]);
  const before = await db.ongoingResult.findMany({where: {match_id: matchId}, orderBy: {result_id: "asc"}});

  const page = await as(phone);
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(handRows(page)).toHaveCount(4);
  await expect(handRow(page, 2)).toHaveAccessibleName("Igra 2: 3 prema 11, ukupno 9 prema 16, razlika 7. Uredi");
  await expectTotal(page, home.name, 20);
  await expectTotal(page, away.name, 23);

  // Igra 2 again: home had 9 and a 4, away 2 and no zvanja → 13 : 2
  await correctHand(page, 2, {team: home.name, points: 9, zvanja: {[home.name]: [4]}});
  await expect(handRow(page, 2)).toHaveAccessibleName("Igra 2: 13 prema 2, ukupno 19 prema 7, razlika 12. Uredi");
  await expect(handRow(page, 3)).toHaveAccessibleName("Igra 3: 7 prema 4, ukupno 26 prema 11, razlika 15. Uredi");
  // Igra 4, a custom hand, opens on Igra with Ručno on: 2 : 9 instead of 4 : 3, nobody at 41 so nothing is asked
  await correctHand(page, 4, {points: {[home.name]: 2, [away.name]: 9}});
  await expect(handRow(page, 4)).toHaveAccessibleName("Igra 4: 2 prema 9, ukupno 28 prema 20, razlika 8. Uredi");
  await expectTotal(page, home.name, 28);
  await expectTotal(page, away.name, 20);

  // the same four rows, two of them changed in place, and the score moved with them
  const after = await db.ongoingResult.findMany({where: {match_id: matchId}, orderBy: {result_id: "asc"}});
  expect(after.map((r) => r.result_id)).toEqual(before.map((r) => r.result_id));
  expect(
    after.map((r) => ({
      points: byTeam(r.team1_game_points, r.team2_game_points),
      threes: byTeam(r.team1_zvanja3, r.team2_zvanja3),
      fours: byTeam(r.team1_zvanja4, r.team2_zvanja4),
      custom: r.custom,
    })),
  ).toEqual([
    {points: [6, 5], threes: [0, 0], fours: [0, 0], custom: false},
    {points: [9, 2], threes: [0, 0], fours: [1, 0], custom: false},
    {points: [7, 4], threes: [0, 0], fours: [0, 0], custom: false},
    {points: [2, 9], threes: [0, 0], fours: [0, 0], custom: true},
  ]);
  const match = await db.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  expect(byTeam(match.player_pair1_score, match.player_pair2_score)).toEqual([28, 20]);
  await healthy(page);
});

// a saved hand's total for each team: its points and its zvanja
const totals = (h: SavedHand): [number, number] => [
  h.team1_game_points + 3 * (h.team1_zvanja3 ?? 0) + 4 * (h.team1_zvanja4 ?? 0),
  h.team2_game_points + 3 * (h.team2_zvanja3 ?? 0) + 4 * (h.team2_zvanja4 ?? 0),
];

test("tables.correction: the second of the seeded hands corrected on team1's phone, and the match moved by the difference", async ({
  as,
  db,
  correction,
  healthy,
}) => {
  const {matchId, phone, team1, team2, hands} = correction;
  expect(hands).toHaveLength(4);
  expect(hands.every((h) => !h.custom)).toBe(true);
  // the hand's points the other way round (11 is odd, so they always change), its zvanja as they were
  const old = hands[1];
  const fixed = {...old, team1_game_points: old.team2_game_points, team2_game_points: old.team1_game_points};
  const expected = [hands[0], fixed, hands[2], hands[3]].map(totals);
  const running = expected.map((_, i) => expected.slice(0, i + 1).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]));
  const row = (i: number) => {
    const [l, r] = expected[i];
    const [tl, tr] = running[i];
    return `Igra ${i + 1}: ${l} prema ${r}, ukupno ${tl} prema ${tr}, razlika ${Math.abs(tl - tr)}. Uredi`;
  };

  // team1's player: team1 on the left of the board
  const page = await as(phone);
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(handRows(page)).toHaveCount(4);
  await expect(handRow(page, 1)).toHaveAccessibleName(row(0));

  await correctHand(page, 2, {team: team1, points: fixed.team1_game_points});
  for (const i of [1, 2, 3]) await expect(handRow(page, i + 1)).toHaveAccessibleName(row(i));
  await expectTotal(page, team1, running[3][0]);
  await expectTotal(page, team2, running[3][1]);

  // one hand changed in place, the others as they were, and the score is the hands' sum
  const after = await db.ongoingResult.findMany({where: {match_id: matchId}, orderBy: {result_id: "asc"}});
  expect(after.map((r) => r.result_id)).toEqual(hands.map((h) => h.result_id));
  expect(after.map((r) => [r.team1_game_points, r.team2_game_points, r.team1_zvanja3, r.team1_zvanja4, r.team2_zvanja3, r.team2_zvanja4])).toEqual(
    [hands[0], fixed, hands[2], hands[3]].map((h) => [h.team1_game_points, h.team2_game_points, h.team1_zvanja3, h.team1_zvanja4, h.team2_zvanja3, h.team2_zvanja4]),
  );
  const match = await db.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  expect([match.player_pair1_score, match.player_pair2_score]).toEqual(running[3]);
  await healthy(page);
});
