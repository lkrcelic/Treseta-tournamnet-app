// C5's own setup and screens: the admin corrects a finished match.
//   - Tables of the test's own: a one-table Kolo tonight in "E2E · Novo kolo" (C1's `night` fixture empties tonight
//     before and after each test, and the server recounts the standings and replays the ratings), its matches played
//     from a player's phone and closed with Završi meč through the app's routes. tables.adminEdit is used up by an edit
//     that puts its match back in play, so every test that changes a finished match makes its own.
//   - The admin's phone scorepad of a league table (/league/<id>/daily-standings/table/<roundId>): Tko igra first, then
//     the board with Meč 1 · Meč 2; a hand's sheet (Ispravi igru, Custom, Obriši igru) and "Meč ostaje bez pobjednika?".
//     Correcting a hand on the keypad is scorepad.ts' correctHand.
//   - A tournament's locked table (/turniri/<id>/stol/<roundId>, the same scorepad): Otključaj partiju, and putting
//     its match back as it was played after a test changed its deciding hand.
import type {Result} from "@prisma/client";
import {expect, type APIRequestContext, type Locator, type Page} from "@playwright/test";
import {MATCH_THRESHOLD, matchState, type PlayedHand} from "@/app/_lib/game/scoring";
import {pickTeams, sidesOf, test, type Night, type Side} from "./c1";
import type {Db} from "./db";
import {addHands, escape, handRow, handRows, publishTable, startMatch, type ApiHand, type Table} from "./scorepad";

export {expect, test};

// ---------- a table of the test's own ----------

export type OwnTable = Table & {
  home: Side;
  away: Side;
  // a home player who opens Početna without an onboarding sheet, and a request context logged in as them
  phone: string;
  player: APIRequestContext;
  // home is team1 or team2 of the round; byTeam reads a pair stored by sides as [home, away], bySide the other way
  homeSide: 1 | 2;
  awaySide: 1 | 2;
  byTeam: <T>(one: T, two: T) => [T, T];
  bySide: <T>(home: T, away: T) => [T, T];
};

// A one-table Kolo of tonight for the league's first two teams, published and started (Tko igra, Meč 1); returns it
// with Meč 1's id
export async function ownTable(night: Night, db: Db, api: (who: string) => Promise<APIRequestContext>): Promise<{table: OwnTable; firstMatch: number}> {
  const {home, away, phone} = await pickTeams(db, night.league.id);
  const table = await publishTable(night.admin, db, night.league.id, night.night, [home.id, away.id]);
  const sides = sidesOf(table, home);
  const firstMatch = await startMatch(night.admin, table.roundId);
  return {
    table: {...table, ...sides, home, away, phone, player: await api(phone)},
    firstMatch,
  };
}

// Hands from the home player's phone, each as [home, away] points (11 between them, or a custom hand's); returns
// their ids
export async function play(table: OwnTable, matchId: number, hands: ([number, number] | {points: [number, number]; custom?: boolean; dosta?: "home" | "away"})[]) {
  const sent: ApiHand[] = hands.map((h) => {
    const [home, away] = Array.isArray(h) ? h : h.points;
    if (Array.isArray(h)) return {points: table.bySide(home, away)};
    const dosta = h.dosta === "home" ? table.homeSide : h.dosta === "away" ? table.awaySide : undefined;
    return {points: table.bySide(home, away), custom: h.custom, dosta};
  });
  return addHands(table.player, matchId, sent);
}

// Završi meč on the table's open match, as the admin's scorepad sends it; returns the next match's id (null: the
// table closed)
export async function finishOpenMatch(admin: APIRequestContext, roundId: number): Promise<number | null> {
  const res = await admin.post(`/api/admin/tables/${roundId}/finish`);
  expect(res.ok(), `Završi meč: ${await res.text()}`).toBeTruthy();
  return ((await res.json()) as {nextOngoingMatchId: number | null}).nextOngoingMatchId;
}

// A finished match as if it had been played for `minutes` before Završi meč closed it (its start moved back)
export async function playedFor(db: Db, matchId: number, minutes: number) {
  const match = await db.match.findUniqueOrThrow({where: {id: matchId}});
  await db.match.update({where: {id: matchId}, data: {start_time: new Date(match.end_time!.getTime() - minutes * 60_000)}});
}

// The two teams' rows in the league's standings, and their players' ratings, to compare before and after
export async function standingsOf(db: Db, leagueId: number, teams: number[]) {
  const rows = await db.teamScore.findMany({where: {league_id: leagueId, team_id: {in: teams}}, orderBy: {team_id: "asc"}});
  return rows.map(({team_id, rounds_played, wins, draws, losses, score, point_difference}) => ({team_id, rounds_played, wins, draws, losses, score, point_difference}));
}

export async function ratingsOf(db: Db, teams: Side[]) {
  const ids = teams.flatMap((t) => t.players.map((p) => p.id));
  const players = await db.player.findMany({where: {id: {in: ids}}, orderBy: {id: "asc"}, select: {id: true, rating: true}});
  return players.map((p) => [p.id, p.rating]);
}

// A match's hands as the rules replay them (scoring.ts' matchState), from the rows the database stores
export const replay = (hands: PlayedHand[], threshold = MATCH_THRESHOLD) => matchState(hands, threshold);

// ---------- the admin's phone scorepad ----------

// Opens the table's scorepad: the admin confirms Tko igra (Tko je igrao, for a closed table) first, every time
export async function openAdminTable(page: Page, leagueId: number, roundId: number) {
  await page.goto(`/league/${leagueId}/daily-standings/table/${roundId}`);
  await expect(page.getByRole("heading", {name: /^Tko (igra|je igrao) ovu rundu\?$/})).toBeVisible();
  await page.getByRole("button", {name: /^Potvrdi( i nastavi)?$/}).click();
  await expect(page.getByRole("button", {name: /^Natrag na kolo \d+$/})).toBeVisible();
}

// Meč n in Meč 1 · Meč 2 (shown once a match is finished): the tab reads "Meč 1 41 : 14 · završen", "Meč 2 u tijeku"
export const matchTab = (page: Page, n: number): Locator => page.getByRole("radiogroup", {name: "Meč"}).getByRole("radio", {name: new RegExp(`^Meč ${n}\\b`)});

export async function pickMatch(page: Page, n: number) {
  await matchTab(page, n).click();
  await expect(matchTab(page, n)).toBeChecked();
}

// The board's note on a finished match
export const finishedNote = (page: Page): Locator => page.getByText(/^(Runda je završena|Meč \d je završen)\. Izmjene mijenjaju rezultat i poredak\.$/);

// A hand's sheet (a tap on hand n): Ispravi igru, Custom, Obriši igru
export async function openHandSheet(page: Page, n: number): Promise<Locator> {
  await handRow(page, n).click();
  const sheet = page.getByRole("dialog", {name: `Igra ${n}`, exact: true});
  await expect(sheet).toBeVisible();
  return sheet;
}

// Obriši igru on hand n's sheet, and its "Obriši igru n?" confirmed
export async function deleteHand(page: Page, n: number) {
  const sheet = await openHandSheet(page, n);
  await sheet.getByRole("button", {name: "Obriši igru"}).click();
  const confirm = page.getByRole("dialog", {name: `Obriši igru ${n}?`});
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", {name: "Obriši igru"}).click();
}

// Custom on hand n's sheet: each team's points typed (by name), then Spremi ispravak
export async function customHand(page: Page, n: number, points: Record<string, number>) {
  const sheet = await openHandSheet(page, n);
  await sheet.getByRole("button", {name: /^Custom/}).click();
  const custom = page.getByRole("dialog", {name: `Igra ${n} · custom`});
  await expect(custom).toBeVisible();
  for (const [team, value] of Object.entries(points)) await custom.getByRole("textbox", {name: `Bodovi ${team}`}).fill(String(value));
  await custom.getByRole("button", {name: "Spremi ispravak"}).click();
}

// "Meč ostaje bez pobjednika?": the warning before a change that leaves a finished match without a winner
export const noWinnerSheet = (page: Page): Locator => page.getByRole("dialog", {name: "Meč ostaje bez pobjednika?"});

// The admin's board: each team's total (its panel's screen-reader line) and how many hands are listed
export async function expectBoard(page: Page, totals: Record<string, number>, hands: number) {
  for (const [team, points] of Object.entries(totals)) {
    await expect(page.getByText(new RegExp(`^${escape(team)}: ${points} bod(a|ova)?(, pobjeda)?$`))).toHaveCount(1);
  }
  await expect(handRows(page)).toHaveCount(hands);
}

// Odustani on "Meč ostaje bez pobjednika?" reached through Obriši igru: nothing is saved, and the hand's sheet, which
// stays open behind the warning, is there again; Zatvori closes it, back to the board
export async function cancelNoWinner(page: Page) {
  const sheet = noWinnerSheet(page);
  await sheet.getByRole("button", {name: "Odustani"}).click();
  await expect(sheet).toBeHidden();
  const handSheet = page.getByRole("dialog", {name: /^Igra \d+$/});
  await expect(handSheet).toBeVisible();
  await handSheet.getByRole("button", {name: "Zatvori"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

// Novo kolo for the next Kolo of tonight, left as a Skica (not approved, not published)
export async function nextSkica(admin: APIRequestContext, leagueId: number, teams: number[]) {
  const res = await admin.post("/api/rounds/generate-multiple", {
    data: {league_id: leagueId, present_teams: teams, numberOfRounds: 1, windowSize: 2, allowRepeats: true},
  });
  expect(res.status(), `Novo kolo: ${await res.text()}`).toBe(201);
}

// A table's finished matches as stored, to compare before and after a change the admin didn't save
export const finishedMatches = (db: Db, roundId: number) =>
  db.match.findMany({
    where: {round_id: roundId},
    orderBy: {id: "asc"},
    select: {id: true, player_pair1_score: true, player_pair2_score: true, winner_side: true, results: {orderBy: {result_id: "asc"}}},
  });

// ---------- the admin's scorepad on the computer ----------

// Opens the table's scorepad on the computer: Tko igra first, as on the phone, then the scorepad with its match buttons
export async function openDesktopTable(page: Page, leagueId: number, roundId: number) {
  await page.goto(`/league/${leagueId}/daily-standings/table/${roundId}`);
  await expect(page.getByRole("heading", {name: /^Tko (igra|je igrao) ovu rundu\?$/})).toBeVisible();
  await page.getByRole("button", {name: /^Potvrdi( i nastavi)?$/}).click();
  await expect(desktopMatch(page, 1)).toBeVisible();
}

// Meč n's button above the hands: "Meč 1 · 41 : 14" and under it "Pobjeda: <team>", "Bez pobjednika" or "U tijeku"
export const desktopMatch = (page: Page, n: number): Locator => page.getByRole("button", {name: new RegExp(`^Meč ${n} · `)});

// The entry panel on the right: "Igra n" for a new hand, "Uredi igru n" for a saved one
export const entryPanel = (page: Page): Locator => page.getByRole("region", {name: /^(Uredi igru|Igra) \d+$/});

// A normal hand in the panel: the team's points on the keypad (the other team gets the rest of 11), then Spremi
export async function desktopHand(page: Page, team: string, points: number) {
  const panel = entryPanel(page);
  const box = panel.getByRole("radiogroup", {name: "Upis za ekipu"}).getByRole("radio", {name: new RegExp(`^${escape(team)}: `)});
  await box.click();
  await expect(box).toHaveAttribute("aria-checked", "true");
  const keypad = panel.getByRole("group", {name: "Bodovi"});
  await keypad.getByRole("button", {name: "Obriši bodove"}).click();
  for (const d of String(points)) await keypad.getByRole("button", {name: d, exact: true}).click();
  await expect(box).toHaveAccessibleName(new RegExp(`^${escape(team)}: ${points} bod(a|ova)?(,|$)`));
  await panel.getByRole("button", {name: /^Spremi (igru|izmjene)$/}).click();
}

// ---------- a tournament's locked table ----------

// A tournament's table on the admin's phone: the league table's scorepad under /turniri/, Tko je igrao first
export async function openTournamentTable(page: Page, tournamentId: number, roundId: number) {
  await page.goto(`/turniri/${tournamentId}/stol/${roundId}`);
  await expect(page.getByRole("heading", {name: /^Tko (igra|je igrao) ovu rundu\?$/})).toBeVisible();
  await page.getByRole("button", {name: /^Potvrdi( i nastavi)?$/}).click();
  await expect(page.getByRole("button", {name: /^Natrag na kolo \d+$/})).toBeVisible();
}

// A hand as stored, a finished match's (Result) or a played one's (OngoingResult, the same columns)
export type StoredHand = Pick<Result, "team1_game_points" | "team2_game_points" | "team1_zvanja3" | "team1_zvanja4" | "team2_zvanja3" | "team2_zvanja4" | "custom" | "dosta_side">;

// What a hand is, to compare hands across the two tables: each team's points and zvanja (3s, 4s), custom, the call
export const handShape = (h: StoredHand) => ({
  points: [h.team1_game_points, h.team2_game_points],
  zvanja: [
    [h.team1_zvanja3, h.team1_zvanja4],
    [h.team2_zvanja3, h.team2_zvanja4],
  ],
  custom: h.custom,
  dosta: h.dosta_side,
});

// A stored hand as the admin's scorepad sends it (AdminHandValidation)
export const adminHand = (h: StoredHand) => ({
  custom: h.custom,
  points1: h.team1_game_points,
  points2: h.team2_game_points,
  zvanja1: {3: h.team1_zvanja3, 4: h.team1_zvanja4},
  zvanja2: {3: h.team2_zvanja3, 4: h.team2_zvanja4},
  dosta: h.dosta_side,
});

// Puts a one-match table's match back as it was played (`hands`, the deciding one last) after a test deleted or
// changed its deciding hand, through the admin's routes: into the finished match while it is still finished, or into
// the match an unlock put back in play, which Završi meč then closes again. allow_no_winner only spares the question
// on the way: with its deciding hand back the match has its winner again.
export async function putBackDecidingHand(admin: APIRequestContext, db: Db, roundId: number, hands: StoredHand[]) {
  const results = {orderBy: {result_id: "asc"}} as const;
  const finished = await db.match.findFirst({where: {round_id: roundId}, orderBy: {id: "desc"}, include: {results}});
  const ongoing = finished ? null : await db.ongoingMatch.findFirst({where: {round_id: roundId}, include: {results}});
  const match = finished ?? ongoing;
  if (!match) throw new Error(`table ${roundId} has no match to put its deciding hand back into`);
  const kind = finished ? "finished" : "ongoing";
  const deciding = hands[hands.length - 1];
  const now = match.results[hands.length - 1];
  if (!now) {
    const target = finished ? {kind, matchId: finished.id} : {kind};
    const res = await admin.post(`/api/admin/tables/${roundId}/hands?allow_no_winner=1`, {data: {target, hand: adminHand(deciding)}});
    expect(res.ok(), `put back the deciding hand of table ${roundId}: ${await res.text()}`).toBeTruthy();
  } else if (JSON.stringify(handShape(now)) !== JSON.stringify(handShape(deciding))) {
    const res = await admin.put(`/api/admin/hands/${kind}/${now.result_id}?allow_no_winner=1`, {data: adminHand(deciding)});
    expect(res.ok(), `put back the deciding hand of table ${roundId}: ${await res.text()}`).toBeTruthy();
  }
  if (ongoing) await finishOpenMatch(admin, roundId);
}
