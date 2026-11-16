// C4 · a hand being entered when Vrijeme partije runs out doesn't count: the server refuses a player's hand saved after
// the deadline (unless the score is level: c4-istek), and the match closes with the score entered when the time was
// up. Treseta's 24de70c8: "A hand still being typed isn't taken"; Bela's DECISIONS #83 and CHANGELOG 07.11.2026:
// "Spremi takes the phone back to the table, which has moved on".
// Each test plays a one-table Kolo of its own in "E2E · Novo kolo" (C1's `night` fixture removes tonight's rounds
// afterwards): 6 : 5 three times (18 : 15, home ahead), then away's 11 : 0 typed late, which would put away ahead: had it
// counted, the match would be away's.
import type {APIRequestContext, Page} from "@playwright/test";
import {pickTeams, sidesOf, type Night, type Side} from "../../helpers/c1";
import {expect, moveDeadline, test, TIME_UP, typeHand} from "../../helpers/c4";
import type {Db} from "../../helpers/db";
import {addHands, expectWins, handRows, publishTable, startMatch, type ApiHand} from "../../helpers/scorepad";

// The test's own table at Meč 1, 18 : 15 for home from a teammate's phone
async function setup(api: (who: string) => Promise<APIRequestContext>, db: Db, night: Night) {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const sides = sidesOf(table, home);
  const matchId = await startMatch(night.admin, table.roundId);
  await addHands(await api(phone), matchId, Array(3).fill({points: sides.bySide(6, 5)}) as ApiHand[]);
  return {table, matchId, home, away, phone, ...sides};
}

// The board open on the home player's phone, away's 11 typed and ready for Spremi; then the time runs out (a second ago)
async function lateHand(page: Page, db: Db, matchId: number, away: Side) {
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(handRows(page)).toHaveCount(3);
  await typeHand(page, {team: away.name, points: 11});
  await moveDeadline(db, matchId, new Date(Date.now() - 1000));
}

test("a hand saved after the time is up is refused and doesn't count, and the match closes with the score it had", async ({as, api, db, night, healthy}) => {
  const {table, matchId, home, away, phone, byTeam, homeSide} = await setup(api, db, night);
  const page = await as(phone);
  await lateHand(page, db, matchId, away);

  // Spremi: the server refuses the hand, with the reason
  const answer = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/ongoing-result" && r.request().method() === "POST");
  await page.getByRole("button", {name: "Spremi", exact: true}).click();
  const refused = await answer;
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toEqual({error: TIME_UP});

  // the board (opened again here; a phone that went back to it by itself is there already) closes the match with the
  // three hands it had, 18 : 15, home's by the time, and Meč 2 follows
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);
  const finished = await db.match.findFirstOrThrow({where: {round_id: table.roundId}, include: {results: true}});
  expect({
    score: byTeam(finished.player_pair1_score, finished.player_pair2_score),
    winner: finished.winner_side,
    byTime: finished.time_expired,
    hands: finished.results.length,
  }).toEqual({score: [18, 15], winner: homeSide, byTime: true, hands: 3});
  await healthy(page);
});

// BUG: Spremi refused after the time stays on the Igra step with "Vrijeme partije je isteklo. Partija se zatvara s
// upisanim rezultatom." and Spremi still on, so the player has to find Nazad twice to reach the table: Treseta's own
// ScorePage.tsx shows the refusal, where Bela's a0686e1 (DECISIONS #83) sends the phone back to the board, which
// follows the closed match (Bela's e721909 later first says the hand wasn't saved, with Na meč).
test("Spremi refused after the time takes the phone back to the table, which has moved on to Meč 2 (Bela DECISIONS #83)", async ({as, api, db, night}) => {
  test.fail();
  const {matchId, home, away, phone} = await setup(api, db, night);
  const page = await as(phone);
  await lateHand(page, db, matchId, away);

  await page.getByRole("button", {name: "Spremi", exact: true}).click();
  // straight to the table (Bela #83), or first the note that the hand wasn't saved, with Na meč (Bela e721909)
  const onward = page.getByRole("button", {name: "Na meč"});
  const board = page.getByText("Meč 2 od 2");
  await expect(onward.or(board)).toBeVisible();
  if (await onward.isVisible()) await onward.click();
  await expect(board).toBeVisible();
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);
});
