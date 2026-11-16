// C4 · the clock of a match: Vrijeme partije is 45 minutes from the match's start, and every raise of the target
// (teams level at or above it play on, 41 → 51 → 61) gives it 5 more; a hand that breaks the tie leaves it where it is,
// and the next match starts on 45 minutes of its own. The countdown beside the target shows the time the database
// gives the match (ends_at), grey until the last five minutes.
// The rules: BELA_SYNC.md · Turniri (Vrijeme partije, Treseta's own: TARGET_RAISE_MINUTES) and Game rules; a hand is
// 11 points, the keypad types one team's, the other gets the rest.
// The test plays a one-table Kolo of its own in "E2E · Novo kolo" (C1's `night` fixture removes tonight's rounds
// afterwards).
import {pickTeams, sidesOf} from "../../helpers/c1";
import {expect, expectClock, GAME_MINUTES, MINUTE, moveDeadline, RAISE_MINUTES, rgb, test} from "../../helpers/c4";
import {addHands, enterHand, expectTotal, finishMatch, publishTable, startMatch, type ApiHand} from "../../helpers/scorepad";
import {color} from "@/app/_styles/tokens";

test("a match has 45 minutes from its start, each raise of the target 5 more, and the countdown shows what the database says", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide} = sidesOf(table, home);
  const clockOf = async () => {
    const m = await db.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
    return {started: m.started_at!, ends: m.ends_at!, minutes: (m.ends_at!.getTime() - m.started_at!.getTime()) / MINUTE};
  };

  // Tko igra · Potvrdi i počni: the match starts now, with 45 minutes
  const before = Date.now();
  const matchId = await startMatch(night.admin, table.roundId);
  const start = await clockOf();
  expect(start.minutes).toBe(GAME_MINUTES);
  expect(start.started.getTime()).toBeGreaterThanOrEqual(before - 5000);
  expect(start.started.getTime()).toBeLessThanOrEqual(Date.now() + 5000);

  // the board counts down from there, in grey and without the five-minute warning
  const page = await as(phone);
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  await expectClock(page, start.ends);
  await expect(page.getByRole("timer")).toHaveCSS("color", rgb(color.muted));
  await expect(page.getByRole("dialog")).toBeHidden();

  // whatever the database says is what the board shows: the match moved to 12 minutes and a half left
  await moveDeadline(db, matchId, new Date(Date.now() + 12.5 * MINUTE));
  const moved = await clockOf();
  await page.reload();
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  await expectClock(page, moved.ends);

  // seven hands from a teammate's phone, 38 : 39; then home's 6 here → 44 : 44, level past 41: Do 51 and 5 minutes more
  const teammate = await api(phone);
  await addHands(teammate, matchId, [6, 6, 6, 5, 5, 5, 5].map((h) => ({points: bySide(h, 11 - h)})) as ApiHand[]);
  await page.reload();
  await expectTotal(page, home.name, 38);
  await enterHand(page, {team: home.name, points: 6});
  await expectTotal(page, home.name, 44);
  await expectTotal(page, away.name, 44);
  await expect(page.getByRole("status", {name: "Izjednačeno, igra se do 51"})).toBeVisible();
  const once = await clockOf();
  expect(once.started).toEqual(moved.started);
  expect(once.ends.getTime() - moved.ends.getTime()).toBe(RAISE_MINUTES * MINUTE);
  await expectClock(page, once.ends);

  // 5 : 6 and 6 : 5 from the teammate → 55 : 55, level past 51: Do 61 and another 5 minutes
  await addHands(teammate, matchId, [{points: bySide(5, 6)}, {points: bySide(6, 5)}]);
  await page.reload();
  await expectTotal(page, home.name, 55);
  await expect(page.getByRole("status", {name: "Izjednačeno, igra se do 61"})).toBeVisible();
  const twice = await clockOf();
  expect(twice.ends.getTime() - moved.ends.getTime()).toBe(2 * RAISE_MINUTES * MINUTE);
  await expectClock(page, twice.ends);

  // home's 6 → 61 : 60: home has won, and a hand that breaks the tie leaves the clock where it was
  await enterHand(page, {team: home.name, points: 6});
  await expect(page.getByText(`${home.name}: 61 bod, pobjeda`)).toBeVisible();
  expect((await clockOf()).ends).toEqual(twice.ends);
  await expectClock(page, twice.ends);

  // Završi meč: the match is home's by the rules, not by the time, and Meč 2 starts on 45 minutes of its own
  expect(await finishMatch(page)).toBe("next");
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  const first = await db.match.findFirstOrThrow({where: {round_id: table.roundId}});
  expect([...byTeam(first.player_pair1_score, first.player_pair2_score), first.time_expired]).toEqual([61, 60, false]);
  const next = await db.ongoingMatch.findFirstOrThrow({where: {round_id: table.roundId}});
  expect(next.ends_at!.getTime() - next.started_at!.getTime()).toBe(GAME_MINUTES * MINUTE);
  await expectClock(page, next.ends_at!);
  await healthy(page);
});
