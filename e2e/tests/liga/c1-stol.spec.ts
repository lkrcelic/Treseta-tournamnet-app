// C1 · players at a table of tonight's Kolo, on the phone: Tko igra and the scorepad (Upiši igru through Zvanja and
// the keypad's 11-split, Spremi), custom hands (Ručno) and "s ovim dosta", and a tie at the target played on to 51.
// Each test publishes its own one-table Kolo in "E2E · Novo kolo" the way the admin does (Novo kolo, Odobri sva,
// Objavi); the `night` fixture removes tonight's rounds afterwards, and the server recounts standings and ratings.
// Expected numbers follow the Treseta rules (src/app/_lib/game/scoring.ts, BELA_SYNC.md · Game rules): a hand is 11
// points, typed for one team, the other gets the rest; zvanja are 3 and 4 on top of the hand; a custom hand types each
// team's points (no zvanja); a match is won at 41 with more points, a team that called "s ovim dosta" wins once it
// reached the target with that hand, even with fewer points, and teams level at or above the target play on to 51.
import {expect, pickTeams, sidesOf, test} from "../../helpers/c1";
import {addHands, enterCustom, enterHand, escape, expectTotal, expectWins, finishMatch, handRow, handRows, publishTable, startMatch, type ApiHand} from "../../helpers/scorepad";

// hands by [home, away] points, as the round's sides store them
const handsOf = (bySide: <T>(home: T, away: T) => [T, T], points: [number, number][]): ApiHand[] => points.map(([h, a]) => ({points: bySide(h, a)}));

test("Tko igra starts the table, and hands entered with zvanja and the keypad are listed with their totals", async ({as, db, night, newcomer, healthy}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  // the league's teams have two players each; for this test the away team has a third, the test's own newcomer, so
  // Tko igra has someone to swap in (the fixture removes the newcomer, and with them the team place, afterwards)
  await db.teamPlayer.create({data: {team_id: away.id, player_id: newcomer.id}});
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam} = sidesOf(table, home);

  // Početna → Započni igru
  const page = await as(phone);
  await page.goto("/");
  await page.getByRole("button", {name: new RegExp(`^STOL 1 .*${escape(home.name)}.*Započni igru$`)}).click();

  // Tko igra: the two players of each team's last round are picked; away's second seat goes to the third player
  await expect(page.getByRole("heading", {name: "Tko igra ovu rundu?"})).toBeVisible();
  for (const team of [home, away]) {
    const seats = page.getByRole("region", {name: team.name, exact: true}).getByRole("button");
    await expect(seats).toHaveCount(2);
    for (const p of team.players) await expect(seats.filter({hasText: `@${p.username}`})).toHaveCount(1);
  }
  const [stays, leaves] = away.players;
  const awaySeats = page.getByRole("region", {name: away.name, exact: true});
  await awaySeats.getByRole("button", {name: new RegExp(`@${escape(leaves.username)} Promijeni$`)}).click();
  const swap = awaySeats.getByRole("list", {name: "Zamijeni igrača"});
  await expect(swap.getByRole("listitem")).toHaveText([newcomer.name]);
  await swap.getByRole("listitem").filter({hasText: newcomer.name}).click();
  await expect(swap).toBeHidden();
  // the swapped seat has the third player, the other seat is as it was
  const seats = awaySeats.getByRole("button");
  await expect(seats).toHaveCount(2);
  for (const username of [stays.username, newcomer.username]) await expect(seats.filter({hasText: `@${username}`})).toHaveCount(1);
  await page.getByRole("button", {name: "Potvrdi i počni"}).click();

  // the scoreboard of the first match, empty, and the lineup saved with the swap
  await expect(page).toHaveURL(/\/ongoing-match\/\d+$/);
  await expect(page.getByText("Meč 1 od 2")).toBeVisible();
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  const lineup = await db.roundPlayer.findMany({where: {round_id: table.roundId}});
  expect(lineup.map((p) => [p.team_id, p.player_id]).sort()).toEqual(
    [...home.players.map((p) => [home.id, p.id]), [away.id, stays.id], [away.id, newcomer.id]].sort(),
  );

  // Igra 1: home 7, away the other 4; zvanja: home a 3, away a 4 → 10 : 8
  await enterHand(page, {team: home.name, points: 7, zvanja: {[home.name]: [3], [away.name]: [4]}});
  await expect(handRow(page, 1)).toHaveAccessibleName("Igra 1: 10 prema 8, ukupno 10 prema 8, razlika 2. Uredi");
  // Igra 2: away 9, home 2; zvanja: home a 3 and a 4 → 9 : 9, 19 : 17
  await enterHand(page, {team: away.name, points: 9, zvanja: {[home.name]: [3, 4]}});
  await expect(handRow(page, 2)).toHaveAccessibleName("Igra 2: 9 prema 9, ukupno 19 prema 17, razlika 2. Uredi");
  // Igra 3: home all 11, away none, but two 4s → 11 : 8, 30 : 25
  await enterHand(page, {team: home.name, points: 11, zvanja: {[away.name]: [4, 4]}});
  await expect(handRow(page, 3)).toHaveAccessibleName("Igra 3: 11 prema 8, ukupno 30 prema 25, razlika 5. Uredi");
  await expectTotal(page, home.name, 30);
  await expectTotal(page, away.name, 25);
  // nobody is at 41: the match goes on
  await expect(page.getByRole("button", {name: "Upiši igru"})).toBeVisible();

  // the database holds the same three hands, by the round's sides
  const match = await db.ongoingMatch.findFirstOrThrow({where: {round_id: table.roundId}, include: {results: {orderBy: {result_id: "asc"}}}});
  expect(byTeam(match.player_pair1_score, match.player_pair2_score)).toEqual([30, 25]);
  expect(
    match.results.map((r) => ({
      points: byTeam(r.team1_game_points, r.team2_game_points),
      threes: byTeam(r.team1_zvanja3, r.team2_zvanja3),
      fours: byTeam(r.team1_zvanja4, r.team2_zvanja4),
      custom: r.custom,
    })),
  ).toEqual([
    {points: [7, 4], threes: [1, 0], fours: [0, 1], custom: false},
    {points: [2, 9], threes: [1, 0], fours: [1, 0], custom: false},
    {points: [11, 0], threes: [0, 0], fours: [0, 2], custom: false},
  ]);
  await healthy(page);
});

test("a custom hand that takes both teams past 41 asks \"s ovim dosta\", and the team that called it wins with fewer points", async ({
  as,
  api,
  db,
  night,
  healthy,
}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide, homeSide, awaySide} = sidesOf(table, home);
  const matchId = await startMatch(night.admin, table.roundId);
  // six hands from a teammate's phone: home 32 + a 4, away 34 + a 4 → 36 : 38
  await addHands(await api(phone), matchId, [
    {points: bySide(6, 5), zvanja: {[homeSide]: [4]}},
    {points: bySide(6, 5), zvanja: {[awaySide]: [4]}},
    ...handsOf(bySide, [
      [5, 6],
      [5, 6],
      [5, 6],
      [5, 6],
    ]),
  ]);

  const page = await as(phone);
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(handRows(page)).toHaveCount(6);
  await expectTotal(page, home.name, 36);
  await expectTotal(page, away.name, 38);

  // Ručno: home 6, away 7 → 42 : 45, both at the target; home called "s ovim dosta"
  await enterCustom(page, {points: {[home.name]: 6, [away.name]: 7}, dosta: home.name});
  await expect(handRow(page, 7)).toHaveAccessibleName("Igra 7: 6 prema 7, ukupno 42 prema 45, razlika 3. Uredi");
  // the board celebrates home, three points behind, and offers Završi meč
  await expect(page.getByText(`${home.name}: 42 boda, pobjeda`)).toBeVisible();
  await expect(page.getByText(`${away.name}: 45 bodova`, {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Upiši igru"})).toBeHidden();
  const called = await db.ongoingResult.findFirstOrThrow({where: {match_id: matchId}, orderBy: {result_id: "desc"}});
  expect({
    points: byTeam(called.team1_game_points, called.team2_game_points),
    zvanja: [called.team1_zvanja3, called.team1_zvanja4, called.team2_zvanja3, called.team2_zvanja4],
    custom: called.custom,
    dosta: called.dosta_side,
  }).toEqual({points: [6, 7], zvanja: [0, 0, 0, 0], custom: true, dosta: homeSide});

  // Završi meč: the match is home's, 42 : 45, and Meč 2 starts with home's win pip
  expect(await finishMatch(page)).toBe("next");
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  const finished = await db.match.findFirstOrThrow({where: {round_id: table.roundId}});
  expect({score: byTeam(finished.player_pair1_score, finished.player_pair2_score), winner: finished.winner_side}).toEqual({score: [42, 45], winner: homeSide});
  const round = await db.round.findUniqueOrThrow({where: {id: table.roundId}});
  expect(byTeam(round.team1_wins, round.team2_wins)).toEqual([1, 0]);
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);
  await healthy(page);
});

test("a custom hand below the target asks nothing, and \"Ne, nitko nije zvao\" leaves the match to the points", async ({as, api, db, night}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide} = sidesOf(table, home);
  const matchId = await startMatch(night.admin, table.roundId);
  // 30 : 25
  await addHands(await api(phone), matchId, handsOf(bySide, [[6, 5], [6, 5], [6, 5], [6, 5], [6, 5]]));

  const page = await as(phone);
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(handRows(page)).toHaveCount(5);
  // Ručno 4 : 3 → 34 : 28: nobody at 41, so no question
  await enterCustom(page, {points: {[home.name]: 4, [away.name]: 3}});
  await expectTotal(page, home.name, 34);
  // Ručno 2 : 15 → 36 : 43: away is at the target and ahead; asked, nobody called it, so away wins on points
  await enterCustom(page, {points: {[home.name]: 2, [away.name]: 15}, dosta: null});
  await expect(page.getByText(`${away.name}: 43 boda, pobjeda`)).toBeVisible();
  await expect(page.getByRole("button", {name: "Završi meč"})).toBeVisible();
  const hands = await db.ongoingResult.findMany({where: {match_id: matchId}, orderBy: {result_id: "asc"}});
  expect(hands.slice(-2).map((h) => [...byTeam(h.team1_game_points, h.team2_game_points), h.custom, h.dosta_side])).toEqual([
    [4, 3, true, null],
    [2, 15, true, null],
  ]);
});

test("teams level at 41 or more play on to 51 (Do 51), and only then is there a winner", async ({as, api, db, night, healthy}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide, homeSide} = sidesOf(table, home);
  const matchId = await startMatch(night.admin, table.roundId);
  // seven hands from a teammate's phone: 38 : 39
  await addHands(await api(phone), matchId, handsOf(bySide, [[6, 5], [6, 5], [6, 5], [5, 6], [5, 6], [5, 6], [5, 6]]));

  const page = await as(phone);
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(handRows(page)).toHaveCount(7);
  const raised = page.getByRole("status", {name: "Izjednačeno, igra se do 51"});
  await expect(raised).toBeHidden();

  // home 6, away 5 → 44 : 44: level past 41, so the target is 51 and the match goes on
  await enterHand(page, {team: home.name, points: 6});
  await expectTotal(page, home.name, 44);
  await expectTotal(page, away.name, 44);
  await expect(raised).toBeVisible();
  await expect(raised).toHaveText("Do 51");
  await expect(page.getByRole("button", {name: "Završi meč"})).toBeHidden();
  // home 6, away 5 → 50 : 49: ahead and past 41, but not at 51 yet
  await enterHand(page, {team: home.name, points: 6});
  await expectTotal(page, home.name, 50);
  await expect(raised).toBeVisible();
  await expect(page.getByRole("button", {name: "Završi meč"})).toBeHidden();
  await expect(page.getByRole("button", {name: "Upiši igru"})).toBeVisible();
  // home 6, away 5 → 56 : 54: home is at 51 and ahead
  await enterHand(page, {team: home.name, points: 6});
  await expect(page.getByText(`${home.name}: 56 bodova, pobjeda`)).toBeVisible();

  expect(await finishMatch(page)).toBe("next");
  const finished = await db.match.findFirstOrThrow({where: {round_id: table.roundId}});
  expect({score: byTeam(finished.player_pair1_score, finished.player_pair2_score), winner: finished.winner_side}).toEqual({score: [56, 54], winner: homeSide});
  await healthy(page);
});
