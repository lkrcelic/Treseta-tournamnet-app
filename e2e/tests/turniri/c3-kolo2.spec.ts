// C3 · Kolo 2 and the end of a tournament, in a tournament of the test's own (five teams, two Kolos, one match a
// table; removed afterwards), with the tables played through the app's routes as the phones play them; and the world's
// finished tournament (tournaments.finished) as a player sees it.
// Expected values (src/app/_lib/tournaments.ts and matching/tournamentPairing.ts, Bela's DECISIONS on the Swiss Kolos):
// a table won is worth a point (one match a table), a bye too, with its 5 : 0; the standings go by points, then the
// difference; from Kolo 2 neighbours in the standings meet, nobody twice, and with an odd number the lowest team that
// hasn't had a bye gets Slobodna runda. Once the last Kolo is played the tournament is over and its first team wins.
import {BYE_MATCH_POINTS} from "@/app/_lib/game/scoring";
import {closeSignUps, expect, freeTeams, handsTo, koloTables, playTable, publishNextKolo, test, type KoloTable, type Team} from "../../helpers/c3";
import {escape} from "../../helpers/scorepad";

// the table won by `winner`, `w : l`, as the round's sides store it
const wonBy = (table: KoloTable, winner: Team, [w, l]: [number, number]) => (table.team1.id === winner.id ? handsTo(w, l) : handsTo(l, w));

// a standings row as Poredak reads it: place, the team's letters and name, wins · draws · losses, points and the
// difference (−, not -)
const row = (place: number, team: {name: string}, [w, d, l]: [number, number, number], points: number, diff: number) =>
  new RegExp(`^${place}\\s*\\S{0,2}?${escape(team.name)}\\s*${w} POB · ${d} NER · ${l} IZG\\s*${points}\\s*${diff > 0 ? "\\+" : diff < 0 ? "−" : ""}${Math.abs(diff)}$`);

test("Kolo 2 pairs the teams by the standings with Slobodna runda for the lowest, and after the last Kolo the winner and the final standings are shown", async ({
  as,
  api,
  db,
  own,
  healthy,
}) => {
  test.setTimeout(180_000);
  const teams = await freeTeams(db, 5, {size: 2});
  const id = await own.make({name: "Švicarski sustav", rounds: 2}, teams);
  await closeSignUps(own.admin, id);
  await publishNextKolo(own.admin, id);

  // Kolo 1, drawn: two tables and a bye
  const kolo1 = await koloTables(db, id, 1, teams);
  expect(kolo1).toHaveLength(3);
  const [a, b] = kolo1.filter((t) => t.team2 != null);
  const bye1 = kolo1.find((t) => t.team2 == null)!;
  expect(bye1.table).toBe(3);
  const byeMatches = await db.match.findMany({where: {round_id: bye1.id}});
  expect(byeMatches.map((m) => [m.player_pair1_score, m.player_pair2_score])).toEqual([[BYE_MATCH_POINTS, 0]]);
  // the first table won 44 : 0, the second 44 : 11
  const [w1, l1] = [a.team1, a.team2!];
  const [w2, l2] = [b.team1, b.team2!];
  const byeTeam = bye1.team1;
  await playTable(await api(w1.phone), a.id, [wonBy(a, w1, [44, 0])]);
  await playTable(await api(w2.phone), b.id, [wonBy(b, w2, [44, 11])]);

  // after Kolo 1: w1 1 (+44), w2 1 (+33), the bye 1 (+5), l2 0 (−33), l1 0 (−44); Kolo 2's draft is made by itself:
  // w1 – w2, the bye team – l2, and the bye for l1, the lowest
  const kolo2Draft = await db.round.findMany({where: {tournamentRounds: {some: {tournament_id: id}}, round_number: 2}, orderBy: {table_number: "asc"}});
  expect(kolo2Draft.map((r) => [r.status, r.team1_id, r.team2_id])).toEqual([
    ["DRAFT", w1.id, w2.id],
    ["DRAFT", byeTeam.id, l2.id],
    ["DRAFT", l1.id, 0],
  ]);

  // the admin's phone shows the draft and publishes it
  const admin = await as("admin");
  await admin.goto(`/turniri/${id}/upravljanje?view=kola&kolo=2`);
  await expect(admin.getByRole("heading", {name: "Skica kola"})).toBeVisible();
  const draft = admin.getByRole("list", {name: "Skica Kola 2, stolovi"}).getByRole("listitem");
  await expect(draft).toHaveCount(3);
  await expect(draft.nth(0)).toHaveText(new RegExp(`^1\\s*${escape(w1.name)}\\s*vs\\s*${escape(w2.name)}$`));
  await expect(draft.nth(1)).toHaveText(new RegExp(`^2\\s*${escape(byeTeam.name)}\\s*vs\\s*${escape(l2.name)}$`));
  await expect(draft.nth(2)).toContainText(l1.name);
  await admin.getByRole("button", {name: "Objavi kolo"}).click();
  await expect(admin.getByRole("heading", {name: "Kolo 2", level: 1})).toBeVisible();
  await healthy(admin);

  // Kolo 2: w2 beats w1 44 : 11, the bye team beats l2 44 : 0
  const kolo2 = await koloTables(db, id, 2, teams);
  await playTable(await api(w2.phone), kolo2[0].id, [wonBy(kolo2[0], w2, [44, 11])]);
  await playTable(await api(byeTeam.phone), kolo2[1].id, [wonBy(kolo2[1], byeTeam, [44, 0])]);

  // the end: w2 2 (+66), the bye team 2 (+49), w1 1 (+11), l1 1 with its bye (−39), l2 0 (−77)
  const page = await as(w2.phone);
  await page.goto(`/turniri/${id}`);
  await expect(page.getByRole("heading", {name: `E2E C3 · Švicarski sustav`, level: 1})).toBeVisible();
  await expect(page.getByText(/^Završeno .* · 5 ekipa$/)).toBeVisible();
  await expect(page.getByRole("region", {name: "Pobjednici"})).toContainText(w2.name);
  await page.getByRole("link", {name: "Poredak i rezultati Konačni poredak i sva kola"}).click();
  await expect(page.getByRole("heading", {name: "Poredak", level: 1})).toBeVisible();
  await expect(page.getByText("Konačni poredak")).toBeVisible();
  await expect(page.getByRole("tablist", {name: "Prikaz"}).getByRole("tab")).toHaveText(["Poredak", "Kolo 1", "Kolo 2"]);
  const standings = page.getByRole("tabpanel", {name: "Poredak"}).getByRole("listitem");
  await expect(standings).toHaveText([
    row(1, w2, [2, 0, 0], 2, 66),
    row(2, byeTeam, [2, 0, 0], 2, 49),
    row(3, w1, [1, 0, 1], 1, 11),
    row(4, l1, [1, 0, 1], 1, -39),
    row(5, l2, [0, 0, 2], 0, -77),
  ]);
  await healthy(page);
  // over: every table closed, and no Kolo 3 made after the last Kolo
  expect(await db.round.count({where: {tournamentRounds: {some: {tournament_id: id}}, open: true}})).toBe(0);
  expect(await db.round.count({where: {tournamentRounds: {some: {tournament_id: id}}, round_number: {gt: 2}}})).toBe(0);
});

test("a bye's match is won by the team that has the bye (winner_side), as a no-show's is", async ({db, own}) => {
  const teams = await freeTeams(db, 3, {size: 2});
  const id = await own.make({name: "Slobodna runda"}, teams);
  await closeSignUps(own.admin, id);
  await publishNextKolo(own.admin, id);
  const bye = (await koloTables(db, id, 1, teams)).find((t) => t.team2 == null)!;
  const matches = await db.match.findMany({where: {round_id: bye.id}});
  expect(matches.map((m) => [m.player_pair1_score, m.player_pair2_score, m.winner_side])).toEqual([[BYE_MATCH_POINTS, 0, 1]]);
});

test("a finished tournament shows its winners, the final standings and every Kolo", async ({as, db, world, healthy}) => {
  const {id, name} = world.tournaments.finished;
  const t = await db.tournament.findUniqueOrThrow({where: {tournament_id: id}});
  // the standings from its tables played to the end: a table won is worth its matches, a draw 1; a skipped table counts
  // for nobody; then the difference of every match's points
  const tables = await db.round.findMany({
    where: {tournamentRounds: {some: {tournament_id: id}}, status: "PUBLISHED", open: false},
    include: {matches: true, team1: true, team2: true},
  });
  const totals = new Map<number, {name: string; won: number; drawn: number; lost: number; points: number; diff: number}>();
  for (const r of tables.filter((r) => r.attendance !== "SKIPPED")) {
    const diff = r.matches.reduce((sum, m) => sum + m.player_pair1_score - m.player_pair2_score, 0);
    for (const [team, won, lost, d] of [
      [r.team1, r.team1_wins, r.team2_wins, diff],
      [r.team2, r.team2_wins, r.team1_wins, -diff],
    ] as const) {
      if (team.team_id === 0) continue;
      const x = totals.get(team.team_id) ?? {name: team.team_name, won: 0, drawn: 0, lost: 0, points: 0, diff: 0};
      if (won > lost) {
        x.won++;
        x.points += r.matches_per_round;
      } else if (won === lost) {
        x.drawn++;
        x.points += 1;
      } else x.lost++;
      x.diff += d;
      totals.set(team.team_id, x);
    }
  }
  const [first, second] = Array.from(totals.values()).sort((a, b) => b.points - a.points || b.diff - a.diff);
  // the world's winner is clear on points or difference (no head-to-head needed)
  expect([first.points, first.diff]).not.toEqual([second.points, second.diff]);

  const page = await as("guest");
  await page.goto(`/turniri/${id}`);
  await expect(page.getByRole("heading", {name, level: 1})).toBeVisible();
  await expect(page.getByText(/^Završeno .* · 14 ekipa$/)).toBeVisible();
  await expect(page.getByRole("region", {name: "Pobjednici"})).toContainText(first.name);
  await page.getByRole("link", {name: "Poredak i rezultati Konačni poredak i sva kola"}).click();
  await expect(page.getByText("Konačni poredak")).toBeVisible();
  await expect(page.getByRole("tablist", {name: "Prikaz"}).getByRole("tab")).toHaveText(["Poredak", ...Array.from({length: t.rounds}, (_, i) => `Kolo ${i + 1}`)]);
  const top = page.getByRole("list", {name: "Prva tri mjesta"}).getByRole("listitem");
  await expect(top).toHaveCount(3);
  await expect(top.first()).toHaveText(row(1, first, [first.won, first.drawn, first.lost], first.points, first.diff));
  await expect(page.getByRole("tabpanel", {name: "Poredak"}).getByRole("listitem")).toHaveCount(14);
  await healthy(page);
});
