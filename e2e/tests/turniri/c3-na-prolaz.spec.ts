// C3 · a table "na prolaz" on the players' phone, in a tournament of the test's own with Kraj partije "na prolaz"
// (removed afterwards). Expected values (BELA_SYNC.md · Game rules, scoring.ts, master 7222cf73): no "s ovim dosta" and
// no raise of the target; the players' Custom key is Kaput, a normal hand of 11 : 0 to the picked team, and the server
// refuses a player's custom hand; teams level at or above 41 play one more hand ("Izjednačeno · još jedna igra"), and
// then the team with more points wins, 50 : 49 included (s ovim dosta would play on to 51).
import {expect, freeTeams, closeSignUps, enterKaput, koloTables, publishNextKolo, test} from "../../helpers/c3";
import {addHands, enterHand, expectTotal, finishMatch, handRow, handRows, dostaQuestion, startMatch, type ApiHand} from "../../helpers/scorepad";

test("na prolaz: Kaput is the players' custom key (11 : 0), a level 44 : 44 plays one more hand without a raise, and 50 : 49 wins", async ({as, api, db, own, healthy}) => {
  const teams = await freeTeams(db, 2, {size: 2});
  const id = await own.make({name: "Na prolaz", match_end: "NA_PROLAZ"}, teams);
  await closeSignUps(own.admin, id);
  await publishNextKolo(own.admin, id);
  const [table] = await koloTables(db, id, 1, teams);
  const round = await db.round.findUniqueOrThrow({where: {id: table.id}});
  expect({end: round.match_end, threshold: round.score_threshold}).toEqual({end: "NA_PROLAZ", threshold: 41});
  // home is the round's team1, so the board and the requests read the same way round
  const home = table.team1;
  const away = table.team2!;
  const phone = await api(home.phone);
  const matchId = await startMatch(phone, table.id);

  const page = await as(home.phone);
  await page.goto(`/ongoing-match/${matchId}`);
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();

  // Kaput for home: a normal hand of 11 : 0, with no question after it
  await enterKaput(page, home.name);
  await expect(handRow(page, 1)).toHaveAccessibleName("Igra 1: 11 prema 0, ukupno 11 prema 0, razlika 11. Uredi");
  const kaput = await db.ongoingResult.findFirstOrThrow({where: {match_id: matchId}});
  expect([kaput.team1_game_points, kaput.team2_game_points, kaput.custom, kaput.dosta_side]).toEqual([11, 0, false, null]);

  // a custom hand from a player's phone is refused at this table
  const custom = await phone.post("/api/ongoing-result", {
    data: {match_id: matchId, team1_game_points: 6, team2_game_points: 7, team1_zvanja3: 0, team1_zvanja4: 0, team2_zvanja3: 0, team2_zvanja4: 0, custom: true, dosta_side: null},
  });
  expect(custom.status()).toBe(400);
  expect(await custom.json()).toEqual({error: "Na prolaz nema ručnog unosa: upiši igru normalno (Kaput je 11 : 0)."});

  // six more hands from the teammate's phone: 38 : 39
  const more: ApiHand[] = [5, 5, 5, 4, 4, 4].map((p) => ({points: [p, 11 - p]}));
  await addHands(phone, matchId, more);
  await page.reload();
  await expect(handRows(page)).toHaveCount(7);
  await expectTotal(page, home.name, 38);
  await expectTotal(page, away.name, 39);

  // home 6 → 44 : 44: level past 41, one more hand, the target stays 41 and nobody is asked "s ovim dosta"
  const level = page.getByRole("status", {name: "Izjednačeno, igra se još jedna igra"});
  await expect(level).toBeHidden();
  await enterHand(page, {team: home.name, points: 6});
  await expectTotal(page, home.name, 44);
  await expectTotal(page, away.name, 44);
  await expect(level).toBeVisible();
  await expect(level).toHaveText("Izjednačeno · još jedna igra");
  await expect(dostaQuestion(page)).toBeHidden();
  await expect(page.getByRole("status", {name: "Izjednačeno, igra se do 51"})).toBeHidden();
  await expect(page.getByRole("button", {name: "Završi meč"})).toBeHidden();
  await expect(page.getByRole("button", {name: "Upiši igru", exact: true})).toBeVisible();

  // home 6 → 50 : 49: the next hand decides, short of 51
  await enterHand(page, {team: home.name, points: 6});
  await expect(page.getByText(`${home.name}: 50 bodova, pobjeda`)).toBeVisible();
  await expect(level).toBeHidden();
  await healthy(page);
  expect(await finishMatch(page)).toBe("end");
  const match = await db.match.findFirstOrThrow({where: {round_id: table.id}});
  expect({score: [match.player_pair1_score, match.player_pair2_score], winner: match.winner_side}).toEqual({score: [50, 49], winner: 1});
  const closed = await db.round.findUniqueOrThrow({where: {id: table.id}});
  expect({open: closed.open, wins: [closed.team1_wins, closed.team2_wins]}).toEqual({open: false, wins: [1, 0]});
});
