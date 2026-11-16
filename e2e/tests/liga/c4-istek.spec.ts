// C4 · Vrijeme partije runs out: the match closes at once with the score entered then, and the team ahead wins it,
// whether anyone reached 41 or not (Match.time_expired, winner_side); the table goes on to Meč 2 or, after Meč 2, to
// Kraj kola. Whoever reads the match first closes it: its scorepad (a reload), or /api/cron/tick when nobody has it
// open. With the score level one more hand is played, and that hand ends the match.
// The rules (BELA_SYNC.md · Turniri, Treseta's 24de70c8, Bela's DECISIONS #83): 45 minutes from the match's start; a
// hand is 11 points, the keypad types one team's, the other gets the rest.
// Time doesn't pass: ends_at is moved in the database. tables.timeLimit (league "E2E · Scorepad") is put back as the
// seed left it by the `timeLimit` fixture; the other tests play a one-table Kolo of their own in "E2E · Novo kolo"
// (C1's `night` fixture removes tonight's rounds afterwards, and the server recounts standings and ratings).
import {minutesAgo, minutesFromNow} from "../../helpers/db";
import {pickTeams, sidesOf} from "../../helpers/c1";
import {expect, GAME_MINUTES, MINUTE, moveDeadline, expectClock, clockMs, rgb, test, tickFor, typeHand} from "../../helpers/c4";
import {addHands, escape, expectTotal, expectWins, handRows, publishTable, startMatch, type ApiHand} from "../../helpers/scorepad";
import {color} from "@/app/_styles/tokens";

test("tables.timeLimit: little time left shows on the countdown and in Još … do kraja partije; once it is up, the reload closes Meč 1 with the score entered and the team ahead wins", async ({
  as,
  db,
  timeLimit,
  healthy,
}) => {
  const {roundId, matchId, phone, team1, team2, score, hands} = timeLimit;
  // the seed leaves a team ahead (a level score plays one more hand: its own test below)
  expect(score[0], `the seeded score ${score.join(" : ")} is level`).not.toBe(score[1]);
  const ahead = score[0] > score[1] ? 1 : 2;

  // three minutes left
  const endsAt = minutesFromNow(3);
  await moveDeadline(db, matchId, endsAt);
  const page = await as(phone);
  await page.goto(`/ongoing-match/${matchId}`);

  // under five minutes the board warns, once: the time left, and that an unsaved hand won't count
  const warning = page.getByRole("dialog").filter({hasText: "do kraja partije"});
  await expect(warning).toBeVisible();
  const heading = warning.getByRole("heading");
  await expect(heading).toHaveText(/^Još \d+:\d\d\s*do kraja partije$/);
  const left = endsAt.getTime() - Date.now();
  expect(Math.abs(clockMs((await heading.textContent()) ?? "") - left)).toBeLessThanOrEqual(3000);
  await expect(warning).toContainText("igra koja još nije spremljena ne računa se");
  await warning.getByRole("button", {name: "U redu"}).click();
  await expect(warning).toBeHidden();

  // the board: the seeded hands, the score, the countdown in red, and Upiši igru still there
  await expect(handRows(page)).toHaveCount(hands);
  await expectTotal(page, team1, score[0]);
  await expectTotal(page, team2, score[1]);
  await expectClock(page, endsAt);
  await expect(page.getByRole("timer")).toHaveCSS("color", rgb(color.red));
  await expect(page.getByRole("button", {name: "Upiši igru"})).toBeVisible();
  // the warning was shown for this match: a reload doesn't bring it back
  await page.reload();
  await expect(handRows(page)).toHaveCount(hands);
  await expect(warning).toBeHidden();

  // the time was up a second ago: the reload closes Meč 1 with the score it had, and the board is Meč 2's
  await moveDeadline(db, matchId, new Date(Date.now() - 1000));
  await page.reload();
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(`/ongoing-match/${matchId}$`));
  await expectWins(page, team1, ahead === 1 ? 1 : 0);
  await expectWins(page, team2, ahead === 2 ? 1 : 0);

  // in the database: Meč 1 with the seeded score, decided by the time for the team ahead; the round has its win
  const finished = await db.match.findMany({where: {round_id: roundId}, include: {results: true}});
  expect(finished.map((m) => ({score: [m.player_pair1_score, m.player_pair2_score], winner: m.winner_side, byTime: m.time_expired, hands: m.results.length}))).toEqual([
    {score, winner: ahead, byTime: true, hands},
  ]);
  const round = await db.round.findUniqueOrThrow({where: {id: roundId}});
  expect([round.team1_wins, round.team2_wins, round.open]).toEqual([ahead === 1 ? 1 : 0, ahead === 2 ? 1 : 0, true]);
  // Meč 2 has its own 45 minutes, from when it opened
  const next = await db.ongoingMatch.findFirstOrThrow({where: {round_id: roundId}});
  expect(next.ends_at!.getTime() - next.started_at!.getTime()).toBe(GAME_MINUTES * MINUTE);
  expect(Math.abs(next.started_at!.getTime() - Date.now())).toBeLessThan(MINUTE);
  await expectClock(page, next.ends_at!);
  await healthy(page);
});

test("/api/cron/tick closes Meč 2 that nobody is reading, and the table ends: Kraj kola, and the standings count it", async ({as, api, db, night, healthy}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide, homeSide} = sidesOf(table, home);
  const scoreOf = (teamId: number) => db.teamScore.findUniqueOrThrow({where: {team_id_league_id: {team_id: teamId, league_id: night.league.id}}});
  const standingsBefore = {home: await scoreOf(home.id), away: await scoreOf(away.id)};

  // Meč 1 from a teammate's phone: 8 : 3 four times and 9 : 2 → 41 : 14, then Završi meč
  const teammate = await api(phone);
  const first = await startMatch(night.admin, table.roundId);
  await addHands(teammate, first, [...Array(4).fill({points: bySide(8, 3)}), {points: bySide(9, 2)}] as ApiHand[]);
  const done = await teammate.post("/api/matches", {data: JSON.stringify(first), headers: {"Content-Type": "application/json"}});
  expect(done.ok(), `Završi meč: ${await done.text()}`).toBeTruthy();
  const second = ((await done.json()) as {nextOngoingMatchId: number}).nextOngoingMatchId;
  // Meč 2: 6 : 5 three times → 18 : 15, home ahead and nobody near 41
  await addHands(teammate, second, Array(3).fill({points: bySide(6, 5)}) as ApiHand[]);

  // the phone had Meč 2 open, then put away
  const page = await as(phone);
  await page.goto(`/ongoing-match/${second}`);
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  await expectTotal(page, home.name, 18);
  await expectTotal(page, away.name, 15);
  await page.goto("about:blank");

  // the time was up a minute ago, and the scheduler's tick closes the match
  await moveDeadline(db, second, minutesAgo(1));
  expect(await tickFor(await api("guest"), db, table.roundId)).toEqual([table.roundId]);
  const closed = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: {orderBy: {id: "asc"}}}});
  expect([closed.open, ...byTeam(closed.team1_wins, closed.team2_wins)]).toEqual([false, 2, 0]);
  expect(closed.matches.map((m) => [...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side, m.time_expired])).toEqual([
    [41, 14, homeSide, false],
    [18, 15, homeSide, true],
  ]);
  expect(await db.ongoingMatch.count({where: {round_id: table.roundId}})).toBe(0);

  // the phone opened again on Meč 2 follows the table to Kraj kola: 2 : 0 for home, both matches' scores
  await page.goto(`/ongoing-match/${second}`);
  await expect(page).toHaveURL(new RegExp(`/round/${table.roundId}/result$`));
  await expect(page.getByRole("heading", {name: "Kraj kola"})).toBeVisible();
  await expect(page.getByRole("main")).toContainText(new RegExp(`${escape(home.name)}\\s*2 pobjede\\s*${escape(away.name)}\\s*0 pobjeda`));
  await expect(page.getByRole("list", {name: "Mečevi"}).getByRole("listitem")).toHaveText([/^Meč 1\s*41\s*14$/, /^Meč 2\s*18\s*15$/]);
  await healthy(page);

  // the standings count the table like any other: home's win, by 27 + 3 = 30 points
  const diff = 27 + 3;
  const after = {home: await scoreOf(home.id), away: await scoreOf(away.id)};
  const moved = (b: typeof after.home, a: typeof after.home) => ({
    rounds_played: a.rounds_played - b.rounds_played,
    wins: a.wins - b.wins,
    losses: a.losses - b.losses,
    score: a.score - b.score,
    point_difference: a.point_difference - b.point_difference,
  });
  expect(moved(standingsBefore.home, after.home)).toEqual({rounds_played: 1, wins: 1, losses: 0, score: 2, point_difference: diff});
  expect(moved(standingsBefore.away, after.away)).toEqual({rounds_played: 1, wins: 0, losses: 1, score: 0, point_difference: -diff});
});

test("a level score when the time is up plays one more hand: the board says so, nothing closes it, and that hand decides the match", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide, homeSide} = sidesOf(table, home);
  const first = await startMatch(night.admin, table.roundId);
  // 6 : 5, 5 : 6, 6 : 5, 5 : 6 from a teammate's phone → 22 : 22
  await addHands(await api(phone), first, [6, 5, 6, 5].map((h) => ({points: bySide(h, 11 - h)})));

  // the time was up a minute ago when the phone opens the board
  await moveDeadline(db, first, minutesAgo(1));
  const page = await as(phone);
  await page.goto(`/ongoing-match/${first}`);
  await expect(page.getByText("Meč 1 od 2")).toBeVisible();
  await expect(handRows(page)).toHaveCount(4);
  await expectTotal(page, home.name, 22);
  await expectTotal(page, away.name, 22);
  await expect(page.getByRole("status").filter({hasText: "Vrijeme je isteklo"})).toHaveText(
    "Vrijeme je isteklo, rezultat je izjednačen. Odigrajte još jednu igru. Nakon upisa te igre partija završava.",
  );
  await expect(page.getByRole("timer")).toHaveAccessibleName("Do kraja partije 0:00");
  // the scheduler's tick leaves it open too
  expect(await tickFor(await api("guest"), db, table.roundId)).toEqual([]);
  expect(await db.ongoingMatch.count({where: {id: first}})).toBe(1);

  // the one more hand, home 7 and away 4 → 29 : 26: the match ends with it, and the board moves on to Meč 2
  await typeHand(page, {team: home.name, points: 7});
  await page.getByRole("button", {name: "Spremi", exact: true}).click();
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);

  const finished = await db.match.findFirstOrThrow({where: {round_id: table.roundId}, include: {results: true}});
  expect({
    score: byTeam(finished.player_pair1_score, finished.player_pair2_score),
    winner: finished.winner_side,
    byTime: finished.time_expired,
    hands: finished.results.length,
  }).toEqual({score: [29, 26], winner: homeSide, byTime: true, hands: 5});
  await healthy(page);
});
