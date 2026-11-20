// C5 · Otključaj partiju stays the manual way on a tournament's table (Bela's c826481, DECISIONS #89 and #97, here with
// the sync of 17 Nov 2026): a finished match the admin's correction leaves without a winner goes back in play by itself
// only while nothing came after it (Treseta 467ea599). A table of Kolo 1 when Kolo 2 is out can't: the warning says so,
// Obriši svejedno leaves the match without a winner and the table locked ("Partija je odigrana do kraja i
// zaključana."), and Otključaj partiju puts the match back in play with its hands and the minutes the admin picks.
// Treseta's own (BELA_SYNC · unlock.ts, gameTime.ts): the hands are Treseta's (11 a hand with zvanja 3 and 4, or
// Custom, to 41), the sheet starts on the table's 45 minutes, and a match whose hands raised the target (41 → 51 …) has
// five more minutes for each raise, counted from its hands as on every match.
// The table is the first played table of Kolo 1 of tournaments.live ("Subotnji turnir uživo", one match per Kolo) whose
// last hand decided its match, as the generator has no tournament of C5's own (asked for in C5's report); the fixture
// puts the hand back, closes the match again through the admin's routes and gives the table and its match back the
// fields the unlock wrote (its own Vrijeme partije, Tu smo, the match's times). The match's row is a new one afterwards.
import type {Result} from "@prisma/client";
import {handTotals, MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import {leagueNight} from "@/app/_lib/dates";
import {
  deleteHand,
  expect,
  expectBoard,
  finishedNote,
  handShape,
  matchTab,
  noWinnerSheet,
  openTournamentTable,
  putBackDecidingHand,
  replay,
  test as base,
} from "../../helpers/c5";
import {escape, expectWins, handRow} from "../../helpers/scorepad";

type Locked = {
  tournamentId: number;
  roundId: number;
  // [team1, team2]: the admin's board shows team1 on the left
  names: [string, string];
  // the match's hands as played, the deciding one last
  hands: Result[];
  // a player of the table, for the players' scorepad
  player: string;
};

const LOCKED = "Partija je odigrana do kraja i zaključana.";

// the warning's sentence: the score after the change, the target nobody has, and why the match stays closed
const cantReopen = (score: {score1: number; score2: number; target: number}, why: string) =>
  `Nakon ove promjene meč je ${score.score1}:${score.score2} i nitko nema ${score.target}. ${why}, pa se ne može ponovno otvoriti igračima: ostaje bez pobjednika dok ne dopišeš igre koje su odigrane. Rezultat stola, poredak i rejting ponovno se računaju.`;

// the minutes left on a match being played, by its deadline
const minutesLeft = (endsAt: Date | null) => (endsAt!.getTime() - Date.now()) / 60_000;

const test = base.extend<{locked: Locked}>({
  locked: async ({api, db, world}, use) => {
    const tournamentId = world.tournaments.live.id;
    const kolos = await db.round.findMany({
      where: {tournamentRounds: {some: {tournament_id: tournamentId}}},
      orderBy: [{round_number: "asc"}, {table_number: "asc"}],
      include: {
        team1: true,
        team2: true,
        roundPlayers: {orderBy: {player_id: "asc"}, include: {player: true}},
        matches: {include: {results: {orderBy: {result_id: "asc"}}}},
        _count: {select: {ongoingMatches: true}},
      },
    });
    expect(kolos.some((r) => r.round_number === 2 && r.status === "PUBLISHED"), "the tournament's Kolo 2 is out").toBe(true);
    // Kolo 1 as the seed played it: every table closed, nothing being played and no unlock's fields left at any (a test
    // that didn't put its table back fails here rather than moving on to the next table)
    const kolo1 = kolos.filter((r) => r.round_number === 1);
    expect(
      kolo1.filter((r) => r.open || r._count.ongoingMatches > 0 || r.game_minutes != null || r.attendance != null).map((r) => r.id),
      "Kolo 1's tables as the seed left them",
    ).toEqual([]);
    // its match won with its last hand, and without it nobody has the target, which was never raised (the raise test
    // raises it itself)
    const decided = (hands: Result[]) => {
      const without = replay(hands.slice(0, -1));
      return hands.length > 1 && replay(hands).winner != null && without.winner == null && without.extensions === 0;
    };
    const round = kolo1.find((r) => r.matches.length === 1 && decided(r.matches[0].results));
    if (!round) throw new Error(`tournament ${tournamentId} has no played table in Kolo 1 whose last hand decided its match`);
    if (round.roundPlayers.length === 0) throw new Error(`table ${round.id} has no lineup`);
    const [match] = round.matches;
    const fields = {
      open: round.open,
      active: round.active,
      game_minutes: round.game_minutes,
      attendance: round.attendance,
      attendance_team_id: round.attendance_team_id,
      attendance_by: round.attendance_by,
      attendance_at: round.attendance_at,
    };
    // A world seeded between midnight and 06:00 dates the live tournament by the calendar day while the league night is
    // still yesterday's, and reopenCheck asks "Stol nije od večeras" before the next Kolo: the table is moved to the
    // league night for the test (Bela's generator dates it so since 8224dfb; asked for in C5's report)
    const tonight = leagueNight();
    if (round.round_date?.getTime() !== tonight.getTime()) await db.round.update({where: {id: round.id}, data: {round_date: tonight}});
    await use({
      tournamentId,
      roundId: round.id,
      names: [round.team1.team_name, round.team2.team_name],
      hands: match.results,
      player: round.roundPlayers[0].player.username,
    });
    await putBackDecidingHand(await api("admin"), db, round.id, match.results);
    await db.round.update({where: {id: round.id}, data: {...fields, round_date: round.round_date}});
    // the match closed again is a new row with the unlock's and the closing's times: the times it was played at
    const times = {match_date: match.match_date, start_time: match.start_time, end_time: match.end_time, time_expired: match.time_expired};
    await db.match.updateMany({where: {round_id: round.id}, data: times});
  },
});

// First of the two, so the next test's check of Kolo 1 sees whether this one's table was put back: a teardown failing
// here would count as this test's expected failure.
// Treseta's own rule (gameTime.ts): every raise of the target gives the match five more minutes, and the deadline is
// counted from the match's hands (syncDeadline), so a match put back in play whose hands raised it has them too.
// BUG: Otključaj partiju gives the resumed match only the minutes picked (unlock.ts' resumeMatch: matchDeadline(now,
// minutes), without the raises), so its clock reads 45:00 and jumps to 50:00 with the next hand, when syncDeadline counts it.
test.fail("a match level at 41 and played on to 51 goes back in play with the minutes the admin picks and five more for the raised target", async ({
  as,
  api,
  db,
  locked: {tournamentId, roundId, names, hands, player},
  healthy,
}) => {
  // The deciding hand corrected to a custom hand that takes both teams to 41, nobody calling: level at 41, the target
  // goes up to 51, and the match is left without a winner (Kolo 2 is out, so it can't go back in play by itself)
  const n = hands.length;
  const without = replay(hands.slice(0, -1));
  const level = {
    ...hands[n - 1],
    team1_game_points: MATCH_THRESHOLD - without.score1,
    team2_game_points: MATCH_THRESHOLD - without.score2,
    team1_zvanja3: 0,
    team1_zvanja4: 0,
    team2_zvanja3: 0,
    team2_zvanja4: 0,
    custom: true,
    dosta_side: null,
  };
  const raised = replay([...hands.slice(0, -1), level]);
  expect([raised.score1, raised.score2, raised.target, raised.extensions, raised.winner]).toEqual([MATCH_THRESHOLD, MATCH_THRESHOLD, MATCH_THRESHOLD + 10, 1, null]);
  const admin = await api("admin");
  const res = await admin.put(`/api/admin/hands/finished/${hands[n - 1].result_id}?allow_no_winner=1`, {
    data: {custom: true, points1: level.team1_game_points, points2: level.team2_game_points, dosta: null},
  });
  expect(res.ok(), `the deciding hand corrected: ${await res.text()}`).toBeTruthy();

  const page = await as("admin");
  await openTournamentTable(page, tournamentId, roundId);
  await expect(page.getByText(LOCKED)).toBeVisible();
  await expectBoard(page, {[names[0]]: MATCH_THRESHOLD, [names[1]]: MATCH_THRESHOLD}, n);
  await expect(page.getByRole("status", {name: "Izjednačeno, igra se do 51"})).toBeVisible();

  // Otključaj partiju with the table's 45 minutes, as the sheet offers them
  await page.getByRole("button", {name: "Otključaj partiju"}).click();
  const sheet = page.getByRole("dialog", {name: "Otključaj partiju"});
  await expect(sheet.getByRole("button", {name: "45 min", exact: true})).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", {name: "Otključaj · 45 min"}).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText(LOCKED)).toHaveCount(0);
  await expect(page.getByRole("status", {name: "Izjednačeno, igra se do 51"})).toBeVisible();
  await healthy(page);

  // 45 minutes from now and 5 for the raise: the deadline the match's hands give, which every later hand keeps
  const open = await db.ongoingMatch.findFirstOrThrow({where: {round_id: roundId}});
  const left = minutesLeft(open.ends_at);
  expect(left, `${left} minutes left`).toBeGreaterThan(49);
  expect(left).toBeLessThanOrEqual(50);
  // and the players' scorepad counts them down
  const phone = await as(player);
  await phone.goto(`/ongoing-match/${open.id}`);
  await expect(phone.getByRole("timer", {name: /^Do kraja partije (49:\d\d|50:00)$/})).toBeVisible();
  await expect(phone.getByText(new RegExp(`^${escape(names[0])}: ${MATCH_THRESHOLD} bod(a|ova)?$`))).toHaveCount(1);
  await healthy(phone);
});

test("Kolo 1's table when Kolo 2 is out: the warning says why the match can't go back in play, the table stays locked, and Otključaj partiju puts it back in play with the minutes the admin picks", async ({
  as,
  db,
  locked: {tournamentId, roundId, names, hands},
  healthy,
}) => {
  const n = hands.length;
  const played = replay(hands);
  const without = replay(hands.slice(0, -1));
  const [last1, last2] = handTotals(hands[n - 1]);
  const page = await as("admin");
  await openTournamentTable(page, tournamentId, roundId);
  await expect(page.getByText(LOCKED)).toBeVisible();
  await expect(handRow(page, n)).toHaveAccessibleName(new RegExp(`^Igra ${n}: ${last1} prema ${last2}, ukupno ${played.score1} prema ${played.score2}, `));
  await expectBoard(page, {[names[0]]: played.score1, [names[1]]: played.score2}, n);

  // Obriši igru on the deciding hand: nobody has 41, and it can't reopen by itself, so the warning, then Obriši svejedno
  await deleteHand(page, n);
  const warning = noWinnerSheet(page);
  await expect(warning).toContainText(cantReopen(without, "Sljedeće kolo je već složeno"));
  await warning.getByRole("button", {name: "Obriši svejedno"}).click();
  await expect(warning).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(matchTab(page, 1)).toBeChecked();
  await expect(matchTab(page, 1)).toHaveAccessibleName(new RegExp(`^Meč 1\\s*${without.score1} : ${without.score2} · završen$`));
  await expectBoard(page, {[names[0]]: without.score1, [names[1]]: without.score2}, n - 1);
  await expectWins(page, names[0], 0, 1);
  await expectWins(page, names[1], 0, 1);
  await expect(page.getByText(LOCKED)).toBeVisible();
  const stillLocked = await db.round.findUniqueOrThrow({where: {id: roundId}, include: {matches: true}});
  expect([stillLocked.open, stillLocked.team1_wins, stillLocked.team2_wins, await db.ongoingMatch.count({where: {round_id: roundId}})]).toEqual([false, 0, 0, 0]);
  expect(stillLocked.matches.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side])).toEqual([[without.score1, without.score2, null]]);

  // Otključaj partiju: the sheet offers 10 to 45 minutes with the table's 45 (Treseta's Vrijeme partije) picked; 20 min
  await page.getByRole("button", {name: "Otključaj partiju"}).click();
  const sheet = page.getByRole("dialog", {name: "Otključaj partiju"});
  await expect(sheet).toContainText("Zadnja odigrana partija se nastavlja s upisanim igrama, s novim vremenom od sada.");
  await expect(sheet.getByRole("button", {name: /^\d+ min$/})).toHaveText(["10 min", "15 min", "20 min", "30 min", "35 min", "45 min"]);
  await expect(sheet.getByRole("button", {name: "45 min", exact: true})).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", {name: "20 min", exact: true}).click();
  await expect(sheet.getByRole("button", {name: "20 min", exact: true})).toHaveAttribute("aria-pressed", "true");
  await sheet.getByRole("button", {name: "Otključaj · 20 min"}).click();
  await expect(sheet).toBeHidden();

  // the board: the match being played with its hands, no Meč tabs, no lock and no note on a finished match
  await expect(page.getByRole("radiogroup", {name: "Meč"})).toBeHidden();
  await expectBoard(page, {[names[0]]: without.score1, [names[1]]: without.score2}, n - 1);
  await expect(page.getByRole("button", {name: "Upiši igru", exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Otključaj partiju"})).toHaveCount(0);
  await expect(page.getByText(LOCKED)).toHaveCount(0);
  await expect(finishedNote(page)).toHaveCount(0);
  await healthy(page);

  // the database: the match is the one being played (its hands with their zvanja), 20 minutes from now, on a table
  // that is open again with its own Vrijeme partije and Tu smo
  expect(await db.match.count({where: {round_id: roundId}})).toBe(0);
  const open = await db.ongoingMatch.findFirstOrThrow({where: {round_id: roundId}, include: {results: {orderBy: {result_id: "asc"}}}});
  expect(open.results.map(handShape)).toEqual(hands.slice(0, -1).map(handShape));
  expect([open.player_pair1_score, open.player_pair2_score, open.score_threshold]).toEqual([without.score1, without.score2, MATCH_THRESHOLD]);
  const left = minutesLeft(open.ends_at);
  expect(left, `${left} minutes left`).toBeGreaterThan(19);
  expect(left).toBeLessThanOrEqual(20);
  const unlocked = await db.round.findUniqueOrThrow({where: {id: roundId}});
  expect([unlocked.open, unlocked.active, unlocked.game_minutes, unlocked.attendance, unlocked.team1_wins, unlocked.team2_wins]).toEqual([true, true, 20, "PRESENT", 0, 0]);
});
