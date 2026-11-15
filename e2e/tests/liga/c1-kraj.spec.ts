// C1 · the end of a table on the phone: Završi meč (and a second, quick tap on it, Bela #74), Meč 2, Kraj kola, then
// Dnevni poredak, Ukupni poredak and the players' ratings. Each test publishes its own one-table Kolo in
// "E2E · Novo kolo" (Novo kolo, Odobri sva, Objavi); the `night` fixture removes tonight's rounds afterwards, and the
// server recounts the standings and replays the ratings.
// The rules: a match is won by the first team at 41 with more points; a league table plays two matches, and a round
// won 2 : 0 is a win worth 2 points in the standings, whose difference is the matches' points for minus against.
import {expect, pickTeams, sidesOf, test} from "../../helpers/c1";
import {addHands, enterHand, escape, expectTotal, expectWins, finishMatch, handRows, publishTable, startMatch, type ApiHand} from "../../helpers/scorepad";

// the standings' signed numbers: "+43", "−43" (a real minus), "0"
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

// BUG: Završi meč empties the board before the next match opens (resetOngoingMatch in ongoing-match/[matchId]/page.tsx),
// so the button turns into Upiši igru under the finger and a second tap opens a hand entry for the finished match.
// Shared code: Bela fixed it in e721909 (#74), which reaches Treseta with the nightly sync. Without test.fail() it is
// red at the URL check: the phone is on /ongoing-match/<finished match>/ongoing-result/new/zvanja.
test("Završi meč tapped twice opens Meč 2 and no hand entry (Bela #74)", async ({as, api, db, night, healthy}) => {
  test.fail();
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide} = sidesOf(table, home);
  const firstMatch = await startMatch(night.admin, table.roundId);
  // from a teammate's phone: 8 : 3 four times and 9 : 2 → 41 : 14, home has won
  await addHands(await api(phone), firstMatch, [...Array(4).fill({points: bySide(8, 3)}), {points: bySide(9, 2)}] as ApiHand[]);

  const page = await as(phone);
  await page.goto(`/ongoing-match/${firstMatch}`);
  await expect(handRows(page)).toHaveCount(5);
  await expectTotal(page, home.name, 41);
  await expectTotal(page, away.name, 14);

  // A second tap on the same spot while the next match opens. The window is held open: on a phone without view
  // transitions (Reduce Motion, older Safari) the board stays tappable while the next page loads, so the test holds that
  // page back and taps again once the board has asked for it. The board must keep Završi meč (loading) until then.
  await page.emulateMedia({reducedMotion: "reduce"});
  const visited: string[] = [];
  page.on("framenavigated", (frame) => frame === page.mainFrame() && visited.push(new URL(frame.url()).pathname));
  let asked!: () => void;
  let release!: () => void;
  const nextPageAsked = new Promise<void>((resolve) => (asked = resolve));
  const nextPageHeld = new Promise<void>((resolve) => (release = resolve));
  const nextPage = /\/ongoing-match\/\d+(\?.*)?$/;
  await page.route(nextPage, async (route) => {
    // the client navigation's request for the next board (RSC payload), not a reload
    if (route.request().headers()["rsc"]) {
      asked();
      await nextPageHeld;
    }
    await route.continue();
  });
  const finishButton = page.getByRole("button", {name: "Završi meč"});
  // a trial tap waits until the board takes taps
  await finishButton.tap({trial: true});
  const box = (await finishButton.boundingBox())!;
  const spot = {x: box.x + box.width / 2, y: box.y + box.height / 2};
  await page.touchscreen.tap(spot.x, spot.y);
  await nextPageAsked;
  await page.touchscreen.tap(spot.x, spot.y);
  release();

  await expect.poll(() => db.match.count({where: {round_id: table.roundId}})).toBe(1);
  const secondMatch = (await db.ongoingMatch.findFirstOrThrow({where: {round_id: table.roundId}})).id;
  await expect(page).toHaveURL(new RegExp(`/ongoing-match/${secondMatch}$`));
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);
  expect(visited.filter((path) => path.includes("/ongoing-result/"))).toEqual([]);
  const first = await db.match.findFirstOrThrow({where: {round_id: table.roundId}});
  expect(byTeam(first.player_pair1_score, first.player_pair2_score)).toEqual([41, 14]);
  expect(await db.ongoingResult.count({where: {match_id: secondMatch}})).toBe(0);
  await page.unroute(nextPage);
  await healthy(page);
});

test("Meč 1 and Meč 2 won on the phone end the Kolo, and Dnevni poredak, Ukupni poredak and the ratings follow", async ({as, api, db, night, healthy}) => {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const {byTeam, bySide, homeSide} = sidesOf(table, home);
  const firstMatch = await startMatch(night.admin, table.roundId);
  const teammate = await api(phone);
  const scoreOf = (teamId: number) => db.teamScore.findUniqueOrThrow({where: {team_id_league_id: {team_id: teamId, league_id: night.league.id}}});
  const standingsBefore = {home: await scoreOf(home.id), away: await scoreOf(away.id)};
  const players = [...home.players, ...away.players];

  // Meč 1: 8 : 3 four times from a teammate's phone (32 : 12), then home's 9 on this phone → 41 : 14
  await addHands(teammate, firstMatch, Array(4).fill({points: bySide(8, 3)}) as ApiHand[]);
  const page = await as(phone);
  await page.goto(`/ongoing-match/${firstMatch}`);
  await expect(handRows(page)).toHaveCount(4);
  await enterHand(page, {team: home.name, points: 9});
  await expect(page.getByText(`${home.name}: 41 bod, pobjeda`)).toBeVisible();
  await expectTotal(page, away.name, 14);
  expect(await finishMatch(page)).toBe("next");
  await expect(page.getByText("Meč 2 od 2")).toBeVisible();
  await expect(page.getByText("Još nema upisanih igara")).toBeVisible();
  await expectWins(page, home.name, 1);
  await expectWins(page, away.name, 0);

  // Meč 2: 7 : 4 five times (35 : 20), then home's 6 → 41 : 25
  const secondMatch = (await db.ongoingMatch.findFirstOrThrow({where: {round_id: table.roundId}})).id;
  await addHands(teammate, secondMatch, Array(5).fill({points: bySide(7, 4)}) as ApiHand[]);
  await page.reload();
  await expect(handRows(page)).toHaveCount(5);
  await enterHand(page, {team: home.name, points: 6});
  await expect(page.getByText(`${home.name}: 41 bod, pobjeda`)).toBeVisible();
  expect(await finishMatch(page)).toBe("end");

  // Kraj kola: 2 : 0 for home, and both matches' scores
  await expect(page).toHaveURL(new RegExp(`/round/${table.roundId}/result$`));
  await expect(page.getByRole("heading", {name: "Kraj kola"})).toBeVisible();
  await expect(page.getByRole("main")).toContainText(new RegExp(`${escape(home.name)}\\s*2 pobjede\\s*${escape(away.name)}\\s*0 pobjeda`));
  await expect(page.getByRole("list", {name: "Mečevi"}).getByRole("listitem")).toHaveText([/^Meč 1\s*41\s*14$/, /^Meč 2\s*41\s*25$/]);
  await healthy(page);

  // the table is closed 2 : 0 for home, both matches home's, by 27 + 16 = 43 points
  const closed = await db.round.findUniqueOrThrow({where: {id: table.roundId}, include: {matches: {orderBy: {id: "asc"}}}});
  expect([closed.open, ...byTeam(closed.team1_wins, closed.team2_wins)]).toEqual([false, 2, 0]);
  expect(closed.matches.map((m) => [...byTeam(m.player_pair1_score, m.player_pair2_score), m.winner_side])).toEqual([
    [41, 14, homeSide],
    [41, 25, homeSide],
  ]);
  const diff = 27 + 16;
  const after = {home: await scoreOf(home.id), away: await scoreOf(away.id)};
  const moved = (b: typeof after.home, a: typeof after.home) => ({
    rounds_played: a.rounds_played - b.rounds_played,
    wins: a.wins - b.wins,
    draws: a.draws - b.draws,
    losses: a.losses - b.losses,
    score: a.score - b.score,
    point_difference: a.point_difference - b.point_difference,
  });
  expect(moved(standingsBefore.home, after.home)).toEqual({rounds_played: 1, wins: 1, draws: 0, losses: 0, score: 2, point_difference: diff});
  expect(moved(standingsBefore.away, after.away)).toEqual({rounds_played: 1, wins: 0, draws: 0, losses: 1, score: 0, point_difference: -diff});

  // the winners' ratings went up and the losers' down, and Početna shows the phone's player the new one
  const ratingsAfter = new Map((await db.player.findMany({where: {id: {in: players.map((p) => p.id)}}})).map((p) => [p.id, p.rating]));
  for (const p of home.players) expect(ratingsAfter.get(p.id)!, `${p.username} won`).toBeGreaterThan(p.rating);
  for (const p of away.players) expect(ratingsAfter.get(p.id)!, `${p.username} lost`).toBeLessThan(p.rating);
  await page.getByRole("button", {name: "Početni zaslon"}).click();
  const me = home.players.find((p) => p.username === phone)!;
  await expect(page.getByRole("link", {name: `Rejting ${ratingsAfter.get(me.id)}`})).toBeVisible();

  // Dnevni poredak: only the two teams played tonight, home first with the win and its 2 points; the Kolo's table done
  await page.goto(`/league/${night.league.id}/daily-standings`);
  const gathering = page.getByRole("tabpanel", {name: "Tablica okupljanja"}).getByRole("listitem");
  await expect(gathering).toHaveText([
    new RegExp(`^1.*${escape(home.name)}\\s*1 POB · 0 NER · 0 IZG\\s*2\\s*${escape(signed(diff))}$`),
    new RegExp(`^2.*${escape(away.name)}\\s*0 POB · 0 NER · 1 IZG\\s*0\\s*${escape(signed(-diff))}$`),
  ]);
  await page.getByRole("tab", {name: `Kolo ${table.roundNumber}`}).click();
  const [w1, w2] = byTeam(2, 0);
  const [d1, d2] = byTeam(diff, -diff);
  await expect(page.getByRole("link", {name: /^Stol 1: /})).toHaveAccessibleName(
    `Stol 1: ${table.team1.name} ${w1}, ${table.team2.name} ${w2}, završeno, razlika ${signed(d1)} : ${signed(d2)}. Otvori stol`,
  );
  await healthy(page);

  // Ukupni poredak: both teams' season rows as the standings now hold them
  await page.goto(`/league/${night.league.id}/standings`);
  await expect(page.getByRole("heading", {name: "Ukupni poredak"})).toBeVisible();
  const season = (team: string, s: typeof after.home) =>
    expect(page.getByRole("listitem").filter({has: page.getByRole("link", {name: team, exact: true})})).toContainText(
      new RegExp(`${s.rounds_played} OK · ${s.wins} POB · ${s.draws} NER · ${s.losses} IZG\\s*${s.score}\\s*${escape(signed(s.point_difference))}`),
    );
  await season(home.name, after.home);
  await season(away.name, after.away);
  await healthy(page);
});
