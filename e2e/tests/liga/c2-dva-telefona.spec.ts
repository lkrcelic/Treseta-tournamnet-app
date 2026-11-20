// C2 · two phones of one team at one table. Several phones follow the same match, and two players may enter the same
// hand: the second save must not count it twice (Bela 3efe0f4, DECISIONS #91: the wizard sends how many hands its board
// held, the server counts them inside the match lock and answers 409 hands_changed, and the phone asks "Je li ovo nova
// igra?" with Odustani and Upiši i ovu). A correction goes its own way and is never asked about.
// On tables.twoPhones (league "E2E · Scorepad", the first match open with the seed's 2 hands), from the phones of
// team1's two players, so both boards have team1 on the left; the `twoPhones` fixture puts the hands back afterwards.
// Expected numbers follow the Treseta rules (src/app/_lib/game/scoring.ts): a hand is 11 points, typed for one team and
// the rest to the other, zvanja 3 and 4 on top; the board's row is the hand's total and the running score.
import {expect, expectBoard, fillHand, openBoard, openEntry, pressSave, sameHandQuestion, test, type TwoPhones} from "../../helpers/c2";
import {enterHand, expectTotal, handRow, handRows, openHand, type Hand, type SavedHand} from "../../helpers/scorepad";
import type {Page} from "@playwright/test";
import type {Db} from "../../helpers/db";

type Totals = [number, number];

// a saved hand's total for each team (team1, team2): its points and its zvanja
const totalsOf = (h: SavedHand): Totals => [
  h.team1_game_points + 3 * (h.team1_zvanja3 ?? 0) + 4 * (h.team1_zvanja4 ?? 0),
  h.team2_game_points + 3 * (h.team2_zvanja3 ?? 0) + 4 * (h.team2_zvanja4 ?? 0),
];

// the board's rows for hands with these totals, team1 on the left: "Igra 3: 10 prema 4, ukupno 15 prema 27, razlika
// 12. Uredi"
function rowNames(hands: Totals[]): string[] {
  let [a, b] = [0, 0];
  return hands.map(([l, r], i) => {
    a += l;
    b += r;
    return `Igra ${i + 1}: ${l} prema ${r}, ukupno ${a} prema ${b}, razlika ${Math.abs(a - b)}. Uredi`;
  });
}

const sum = (hands: Totals[]): Totals => hands.reduce(([a, b], [l, r]) => [a + l, b + r], [0, 0]);

// every row of the board as rowNames gives them
async function expectRows(page: Page, hands: Totals[]) {
  const names = rowNames(hands);
  await expect(handRows(page)).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(handRow(page, i + 1)).toHaveAccessibleName(name);
}

// The match in the database: its hands in order as [team1 points, team2 points, team1 3s, team1 4s, team2 3s, team2 4s]
// and its score, which is always the sum of the hands' totals
async function expectMatch(db: Db, matchId: number, hands: number[][]) {
  const saved = await db.ongoingResult.findMany({where: {match_id: matchId}, orderBy: {result_id: "asc"}});
  expect(saved.map((h) => [h.team1_game_points, h.team2_game_points, h.team1_zvanja3, h.team1_zvanja4, h.team2_zvanja3, h.team2_zvanja4])).toEqual(hands);
  const match = await db.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  const totals = hands.map(([p1, p2, a3, a4, b3, b4]): Totals => [p1 + 3 * a3 + 4 * a4, p2 + 3 * b3 + 4 * b4]);
  expect([match.player_pair1_score, match.player_pair2_score]).toEqual(sum(totals));
  return saved;
}

const columns = (h: SavedHand) => [h.team1_game_points, h.team2_game_points, h.team1_zvanja3 ?? 0, h.team1_zvanja4 ?? 0, h.team2_zvanja3 ?? 0, h.team2_zvanja4 ?? 0];

// Both phones on the board, both open Upiši igru and type the same hand; the first saves it. Resolves with the second
// phone on Igra, its Spremi not pressed yet.
async function sameHandOnBoth(first: Page, second: Page, {matchId, hands}: TwoPhones, hand: Hand, total: Totals) {
  for (const page of [first, second]) {
    await openBoard(page, matchId);
    await expect(handRows(page)).toHaveCount(hands.length);
  }
  for (const page of [first, second]) {
    await openEntry(page);
    await fillHand(page, hand);
  }
  expect((await pressSave(first)).status()).toBe(200);
  await expectBoard(first, hands.length + 1);
  await expectRows(first, [...hands.map(totalsOf), total]);
}

// Bela #57: the wizard sends how many hands its board had, so a second save of the same hand asks first (Bela 3efe0f4, in
// Treseta's own hand entry with the sync of 17 Nov 2026)
test("the same hand saved from both phones of a team is saved once: the second phone is asked „Je li ovo nova igra?” (Bela #57)", async ({
  as,
  db,
  twoPhones,
  healthy,
}) => {
  const {matchId, phones, team1, hands} = twoPhones;
  const [first, second] = [await as(phones[0]), await as(phones[1])];
  // team1 7 and a 3, team2 the other 4 → 10 : 4
  const hand: Hand = {team: team1, points: 7, zvanja: {[team1]: [3]}};
  await sameHandOnBoth(first, second, twoPhones, hand, [10, 4]);

  // the second phone saves the same hand: held back, and the match holds it once
  const answer = await pressSave(second);
  await expectMatch(db, matchId, [...hands.map(columns), [7, 4, 1, 0, 0, 0]]);
  expect(answer.status()).toBe(409);
  // a question, not a refusal (DECISIONS #91): 409 hands_changed, with the hands the match holds now (the seed's 2 and
  // the first phone's)
  expect(await answer.json()).toMatchObject({code: "hands_changed", hands: 3});
  // the phone asks, naming the other phone's hand in its own left/right order
  const question = sameHandQuestion(second);
  await expect(question).toBeVisible();
  await expect(question).toContainText("S drugog mobitela je upisana igra 3 (10 : 4). Ako je to ova ista igra, odustani.");
  await expect(question.getByRole("button", {name: "Odustani"})).toBeVisible();
  await expect(question.getByRole("button", {name: "Upiši i ovu"})).toBeVisible();
  await healthy(second);
});

test("after the question, Odustani shows the other phone's hand on the board, and the phone goes on with the next hand (Bela #57)", async ({
  as,
  db,
  twoPhones,
  healthy,
}) => {
  const {matchId, phones, team1, team2, hands} = twoPhones;
  const seeded = hands.map(totalsOf);
  const [first, second] = [await as(phones[0]), await as(phones[1])];
  await sameHandOnBoth(first, second, twoPhones, {team: team1, points: 7, zvanja: {[team1]: [3]}}, [10, 4]);

  await pressSave(second);
  const question = sameHandQuestion(second);
  await expect(question).toBeVisible();
  await question.getByRole("button", {name: "Odustani"}).click();
  await expect(question).toBeHidden();
  // the second phone's board has the first phone's hand, once
  await expectRows(second, [...seeded, [10, 4]]);

  // and goes on: team1 8, team2 3 → saved at once, no question
  await enterHand(second, {team: team1, points: 8});
  const all: Totals[] = [...seeded, [10, 4], [8, 3]];
  await expectRows(second, all);
  await expectTotal(second, team1, sum(all)[0]);
  await expectTotal(second, team2, sum(all)[1]);
  await first.reload();
  await expectRows(first, all);
  await expectMatch(db, matchId, [...hands.map(columns), [7, 4, 1, 0, 0, 0], [8, 3, 0, 0, 0, 0]]);
  await healthy(second);
});

test("a board left open picks up the other phone's hand on its own refresh, and that phone's next hand is saved once", async ({as, db, twoPhones, healthy}) => {
  const {matchId, phones, team1, team2, hands} = twoPhones;
  const seeded = hands.map(totalsOf);
  const [first, second] = [await as(phones[0]), await as(phones[1])];
  for (const page of [first, second]) {
    await openBoard(page, matchId);
    await expect(handRows(page)).toHaveCount(2);
  }

  // the first phone: team1 6, team2 5 and a 4 → 6 : 9
  await enterHand(first, {team: team1, points: 6, zvanja: {[team2]: [4]}});
  const withFirst: Totals[] = [...seeded, [6, 9]];
  await expectRows(first, withFirst);
  // the second phone, untouched: its board asks the server again every 15 s and lists the hand
  await expect(handRows(second)).toHaveCount(3, {timeout: 30_000});
  await expectRows(second, withFirst);
  await expectTotal(second, team1, sum(withFirst)[0]);
  await expectTotal(second, team2, sum(withFirst)[1]);

  // the second phone goes on: team1 9, team2 2 → Igra 4, saved at once
  await enterHand(second, {team: team1, points: 9});
  const all: Totals[] = [...withFirst, [9, 2]];
  await expectRows(second, all);
  await expectMatch(db, matchId, [...hands.map(columns), [6, 5, 0, 0, 0, 1], [9, 2, 0, 0, 0, 0]]);
  await healthy(first);
  await healthy(second);
});

test("one phone corrects a hand while the other enters a new one: nobody is asked, the correction stays in place and the new hand is saved once", async ({
  as,
  db,
  twoPhones,
  healthy,
}) => {
  const {matchId, phones, team1, team2, hands} = twoPhones;
  const seeded = hands.map(totalsOf);
  const [first, second] = [await as(phones[0]), await as(phones[1])];
  for (const page of [first, second]) {
    await openBoard(page, matchId);
    await expect(handRows(page)).toHaveCount(2);
  }

  // The second phone opens Upiši igru and types team1 8 (8 : 3). Meanwhile the first corrects Igra 1 to team1 9, team2
  // 2, no zvanja (9 : 2) and saves; then the second saves its new hand
  await openEntry(second);
  await fillHand(second, {team: team1, points: 8});
  await openHand(first, 1);
  await fillHand(first, {team: team1, points: 9});
  expect((await pressSave(first)).status()).toBe(200);
  await expectBoard(first, 2);
  await expectRows(first, [[9, 2], seeded[1]]);
  expect((await pressSave(second)).status()).toBe(200);
  await expectBoard(second, 3);
  await expectRows(second, [[9, 2], seeded[1], [8, 3]]);

  // The other way round, from boards that both list the new hand (the first phone's went back to the board before it
  // was saved; otherwise its next hand is rightly asked about): the first phone opens Upiši igru and types team2 6 with
  // team1's 4 (5 + 4 : 6). Meanwhile the second corrects Igra 2 to team1 7, team2 4, no zvanja; the new hand is saved
  // first, then the correction
  await first.reload();
  await expectRows(first, [[9, 2], seeded[1], [8, 3]]);
  await openEntry(first);
  await fillHand(first, {team: team2, points: 6, zvanja: {[team1]: [4]}});
  await openHand(second, 2);
  await fillHand(second, {team: team1, points: 7});
  expect((await pressSave(first)).status()).toBe(200);
  await expectBoard(first, 4);
  expect((await pressSave(second)).status()).toBe(200);
  await expectBoard(second, 4);

  // both boards: four hands, the two corrected in place and the two new ones once each
  const all: Totals[] = [
    [9, 2],
    [7, 4],
    [8, 3],
    [9, 6],
  ];
  await expectRows(second, all);
  await first.reload();
  await expectRows(first, all);
  for (const page of [first, second]) {
    await expectTotal(page, team1, sum(all)[0]);
    await expectTotal(page, team2, sum(all)[1]);
  }
  const saved = await expectMatch(db, matchId, [
    [9, 2, 0, 0, 0, 0],
    [7, 4, 0, 0, 0, 0],
    [8, 3, 0, 0, 0, 0],
    [5, 6, 0, 1, 0, 0],
  ]);
  // the corrected hands are the seed's rows, changed in place
  expect(saved.slice(0, 2).map((h) => h.result_id)).toEqual(hands.map((h) => h.result_id));
  await healthy(first);
  await healthy(second);
});
