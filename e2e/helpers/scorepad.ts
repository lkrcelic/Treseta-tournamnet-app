// The players' scorepad (/ongoing-match/<id>), as a phone uses it: enter a hand (Zvanja, then Igra on the keypad),
// enter a custom hand (Ručno) and answer "s ovim dosta", open and correct a saved hand, finish a match.
// Teams are named as the scorepad shows them, never left/right: the viewer's own team is on the left.
// The admin's phone scorepad (/league/<id>/daily-standings/table/<roundId>, after Tko igra's Potvrdi i nastavi) shares
// the two steps, so enterHand, openHand and correctHand work there too (tried by C1, not in its specs); its Custom is a
// sheet of its own, which enterCustom doesn't cover, and finishMatch is only checked on the players' board (the admin's
// Završi meč stays on its page: ?mec=2, ?kraj=1).
//
// Below that, the setup a scorepad test needs through the app's own routes (a request context from the `api` fixture):
// a table of tonight's league night, its first match started, hands saved as another phone saves them, the clock of a
// match seeded earlier, a hand put back after a test changed it, and the night's rounds removed again.
import {expect, type APIRequestContext, type Locator, type Page} from "@playwright/test";
import {MATCH_THRESHOLD} from "@/app/_lib/game/scoring";
import type {Db} from "./db";

// a zvanje is worth 3 (tri iste, napola) or 4 (četiri iste)
export type Zvanje = 3 | 4;

// A hand: `points` typed on the keypad for `team` (the other team gets the rest of 11), and each team's zvanja, one
// entry per zvanje ({Purgeri: [3, 4]}); a team left out has none
export type Hand = {team: string; points: number; zvanja?: Record<string, Zvanje[]>};

// A custom hand (Ručno): each team's points typed on its own, 0 to 99, without zvanja. `dosta` answers the question the
// board asks when the hand took a team to the target: the team that called "s ovim dosta", or null for "Ne, nitko nije
// zvao". Left out, the board must not ask.
export type CustomHand = {points: Record<string, number>; dosta?: string | null};

export const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------- reading the board ----------

// every saved hand of the match on the board; its name reads "Igra 3: 7 prema 4, ukupno 25 prema 16, razlika 9. Uredi"
// (each hand's total: its points and zvanja)
export const handRows = (page: Page): Locator => page.getByRole("button", {name: /^Igra \d+: /});

// hand n (1-based)
export const handRow = (page: Page, n: number): Locator => page.getByRole("button", {name: new RegExp(`^Igra ${n}: `)});

// The team's total on the board, from its panel's screen-reader line ("Purgeri: 41 bod", ", pobjeda" once it won)
export async function expectTotal(page: Page, team: string, points: number) {
  await expect(page.getByText(new RegExp(`^${escape(team)}: ${points} bod(a|ova)?(, pobjeda)?$`))).toHaveCount(1);
}

// The team's round wins on the board: the pips next to its name ("1 od 2 u kolu")
export async function expectWins(page: Page, team: string, wins: number, of = 2) {
  const nameRow = page.getByRole("heading", {name: team, exact: true}).locator("xpath=..");
  await expect(nameRow.getByRole("img", {name: /^\d+ od \d+ u kolu$/})).toHaveAccessibleName(`${wins} od ${of} u kolu`);
}

// The question after a custom hand that took a team to the target
export const dostaQuestion = (page: Page): Locator => page.getByRole("dialog", {name: "Je li netko zvao „s ovim dosta”?"});

// ---------- entering and correcting ----------

// Upiši igru, Zvanja, Igra, Spremi; resolves once the board lists the new hand, and returns its row
export async function enterHand(page: Page, hand: Hand): Promise<Locator> {
  const before = await openNewHand(page);
  await zvanjaStep(page, hand.zvanja);
  await pointsStep(page, hand);
  await save(page);
  await expect(handRows(page)).toHaveCount(before + 1);
  return handRow(page, before + 1);
}

// Upiši igru, Ručno, each team's points, Spremi, then the "s ovim dosta" question as `dosta` says; resolves on the
// board with the new hand listed (and the question answered), and returns its row
export async function enterCustom(page: Page, hand: CustomHand): Promise<Locator> {
  const before = await openNewHand(page);
  await zvanjaStep(page);
  await customStep(page, hand.points);
  await save(page);
  await answerDosta(page, hand.dosta, handRow(page, before + 1));
  await expect(handRows(page)).toHaveCount(before + 1);
  return handRow(page, before + 1);
}

// A tap on hand n: resolves on the hand's first step, Zvanja (Igra for a custom hand or a table "bez zvanja"). On the
// admin's phone scorepad the tap opens the hand's sheet first, where "Ispravi igru" leads to the same step.
export async function openHand(page: Page, n: number) {
  await handRow(page, n).click();
  const step = zvanjaBoxes(page).or(pointsBoxes(page));
  const adminSheet = page.getByRole("button", {name: /^Ispravi igru/});
  await expect(step.or(adminSheet)).toBeVisible();
  if (await adminSheet.isVisible()) await adminSheet.click();
  await expect(step).toBeVisible();
}

// Corrects saved hand n step by step and saves it; resolves back on the board with as many hands as before.
// A normal hand (`team`, `points`, `zvanja`): what the change names is replaced (zvanja: both teams', a team left out
// gets none), the rest stays as it was saved. A custom hand (`points` per team, `dosta`): both teams' points are typed
// again, and the board asks "s ovim dosta" again when the hand takes a team to the target.
export async function correctHand(page: Page, n: number, change: Partial<Hand> | CustomHand) {
  await expect(handRow(page, n)).toBeVisible();
  const before = await handRows(page).count();
  await openHand(page, n);
  if (isCustom(change)) {
    await customStep(page, change.points);
    await save(page);
    await answerDosta(page, change.dosta, handRow(page, n));
    await expect(handRows(page)).toHaveCount(before);
    return;
  }
  if (await zvanjaBoxes(page).isVisible()) await zvanjaStep(page, change.zvanja);
  else if (change.zvanja) throw new Error(`hand ${n} opened on Igra: a custom hand or a table "bez zvanja" has no zvanja`);
  await pointsStep(page, change);
  await save(page);
  await expect(handRows(page)).toHaveCount(before);
}

// Završi meč: resolves on the next match's board ("next") or on Kraj kola ("end")
export async function finishMatch(page: Page): Promise<"next" | "end"> {
  const finish = page.getByRole("button", {name: "Završi meč"});
  await expect(finish).toBeVisible();
  const from = page.url();
  await finish.click();
  await expect(page).not.toHaveURL(from);
  const end = page.getByRole("heading", {name: "Kraj kola"});
  await expect(end.or(page.getByRole("button", {name: "Upiši igru", exact: true}))).toBeVisible();
  return (await end.isVisible()) ? "end" : "next";
}

const zvanjaBoxes = (page: Page) => page.getByRole("radiogroup", {name: "Zvanja: upis za ekipu"});
const pointsBoxes = (page: Page) => page.getByRole("radiogroup", {name: "Igra: upis za ekipu"});
const keypadOf = (page: Page) => page.getByRole("group", {name: "Bodovi igre"});
const isCustom = (change: Partial<Hand> | CustomHand): change is CustomHand => typeof change.points === "object";

// Upiši igru on the board; returns how many hands it listed before
async function openNewHand(page: Page): Promise<number> {
  const add = page.getByRole("button", {name: "Upiši igru", exact: true});
  await expect(add).toBeVisible();
  const before = await handRows(page).count();
  await add.click();
  await expect(zvanjaBoxes(page).or(pointsBoxes(page))).toBeVisible();
  return before;
}

// The Zvanja step (skipped at a table "bez zvanja"): a box per team picks whose zvanja the 3 and 4 add; given zvanja
// replace both teams' (a team left out has none), then Dalje (or Nema zvanja)
async function zvanjaStep(page: Page, zvanja?: Record<string, Zvanje[]>) {
  const boxes = zvanjaBoxes(page);
  if (!(await boxes.isVisible())) {
    if (zvanja) throw new Error('this table plays "bez zvanja": no Zvanja step');
    return;
  }
  if (zvanja) {
    const teams = await teamsOf(boxes, "zvanja");
    const unknown = Object.keys(zvanja).filter((t) => !teams.includes(t));
    if (unknown.length) throw new Error(`no team ${unknown.join(", ")} at this table (${teams.join(", ")})`);
    for (const team of teams) {
      const box = boxes.getByRole("radio", {name: new RegExp(`^${escape(team)}: zvanja \\d+$`)});
      await box.click();
      await expect(box).toBeChecked();
      const buttons = page.getByRole("group", {name: `Zvanja: ${team}`});
      await buttons.getByRole("button", {name: "Obriši zvanja"}).click();
      const list = zvanja[team] ?? [];
      for (const z of list) await buttons.getByRole("button", {name: new RegExp(`^Zvanje ${z}(,|$)`)}).click();
      await expect(box).toHaveAccessibleName(`${team}: zvanja ${list.reduce((s, z) => s + z, 0)}`);
    }
  }
  await page.getByRole("button", {name: /^(Dalje|Nema zvanja)$/}).click();
}

// The Igra step of a normal hand: the keypad types `points` for `team`, the other team gets the rest of 11
async function pointsStep(page: Page, hand: Partial<Hand>) {
  const keypad = keypadOf(page);
  await expect(keypad).toBeVisible();
  if (hand.team === undefined || hand.points === undefined) return;
  // Obriši bodove first, so the digits make a new number
  await keypad.getByRole("button", {name: "Obriši bodove"}).click();
  const box = await pickTeam(page, hand.team);
  for (const d of String(hand.points)) await keypad.getByRole("button", {name: d, exact: true}).click();
  await expect(box).toHaveAccessibleName(new RegExp(`^${escape(hand.team)}: igra ${hand.points}(,|$)`));
}

// The Igra step of a custom hand: Ručno on, then each team's points typed on its own
async function customStep(page: Page, points: Record<string, number>) {
  const keypad = keypadOf(page);
  await expect(keypad).toBeVisible();
  const manual = keypad.getByRole("button", {name: "Ručno"});
  // a saved custom hand opens with Ručno already on
  if ((await manual.getAttribute("aria-pressed")) !== "true") await manual.click();
  await expect(manual).toHaveAttribute("aria-pressed", "true");
  await keypad.getByRole("button", {name: "Obriši bodove"}).click();
  const teams = await teamsOf(pointsBoxes(page), "igra");
  const unknown = Object.keys(points).filter((t) => !teams.includes(t));
  if (unknown.length || Object.keys(points).length !== 2) throw new Error(`a custom hand types both teams' points: ${teams.join(", ")}`);
  for (const [team, n] of Object.entries(points)) {
    const box = await pickTeam(page, team);
    for (const d of String(n)) await keypad.getByRole("button", {name: d, exact: true}).click();
    await expect(box).toHaveAccessibleName(`${team}: igra ${n}`);
  }
}

// the team's box on the Igra step, picked
async function pickTeam(page: Page, team: string): Promise<Locator> {
  const box = pointsBoxes(page).getByRole("radio", {name: new RegExp(`^${escape(team)}: igra \\d+`)});
  await box.click();
  await expect(box).toBeChecked();
  return box;
}

async function save(page: Page) {
  await page.getByRole("button", {name: "Spremi", exact: true}).click();
  await expect(keypadOf(page)).toBeHidden();
}

// Back on the board after a custom hand: the question comes with the board's first view of the hand (`row`), and the
// sheet hides the board from the accessibility tree while it is open
async function answerDosta(page: Page, dosta: string | null | undefined, row: Locator) {
  const question = dostaQuestion(page);
  await expect(question.or(row)).toBeVisible();
  if (dosta === undefined) {
    await expect(question).toBeHidden();
    return;
  }
  await expect(question).toBeVisible();
  await question.getByRole("button", {name: dosta ?? "Ne, nitko nije zvao", exact: true}).click();
  await expect(question).toBeHidden();
}

// the two team names of a step's boxes ("Purgeri: zvanja 7" → "Purgeri", "Purgeri: igra 4, zvanja 3, ukupno 7" →
// "Purgeri")
async function teamsOf(boxes: Locator, label: string): Promise<string[]> {
  const names = await boxes.getByRole("radio").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  return names.map((n) => n.replace(new RegExp(`: ${label} \\d+(,.*)?$`), ""));
}

// ---------- setup through the app's routes ----------

export type Table = {roundId: number; roundNumber: number; team1: {id: number; name: string}; team2: {id: number; name: string}};

// A hand as a phone sends it, by the round's sides (1 is the round's team1): each team's points (11 between them, or
// up to 99 on a custom hand), each side's zvanja ({1: [3], 2: [4, 4]}), and on a custom hand the side that called
// "s ovim dosta"
export type ApiHand = {points: [number, number]; zvanja?: Partial<Record<1 | 2, Zvanje[]>>; custom?: boolean; dosta?: 1 | 2};

// A new Kolo of tonight with one table for these two teams, made as the admin makes it (Novo kolo's pairing, Odobri
// sva, Objavi). The pairing decides which team is team1.
export async function publishTable(admin: APIRequestContext, db: Db, leagueId: number, night: string, teams: [number, number]): Promise<Table> {
  const created = await admin.post("/api/rounds/generate-multiple", {
    data: {league_id: leagueId, present_teams: teams, numberOfRounds: 1, windowSize: 2, allowRepeats: true},
  });
  expect(created.status(), `Novo kolo: ${await created.text()}`).toBe(201);
  for (const step of ["approve", "publish"]) {
    const res = await admin.post(`/api/leagues/${leagueId}/nights/${night}/${step}`);
    expect(res.ok(), `${step}: ${await res.text()}`).toBeTruthy();
  }
  const round = await db.round.findFirstOrThrow({
    where: {leagueRounds: {some: {league_id: leagueId}}, round_date: new Date(night), team1_id: {in: teams}, team2_id: {in: teams}, status: "PUBLISHED", open: true},
    orderBy: {id: "desc"},
    include: {team1: true, team2: true},
  });
  return {
    roundId: round.id,
    roundNumber: round.round_number!,
    team1: {id: round.team1_id, name: round.team1.team_name},
    team2: {id: round.team2_id, name: round.team2.team_name},
  };
}

// Tko igra with the suggested players, then the first match (Potvrdi i počni). Returns the open match's id.
export async function startMatch(api: APIRequestContext, roundId: number): Promise<number> {
  const lineup = await api.get(`/api/rounds/${roundId}/lineup`);
  expect(lineup.ok(), `lineup: ${await lineup.text()}`).toBeTruthy();
  const {teams} = (await lineup.json()) as {teams: {id: number; selected: number[]}[]};
  const saved = await api.put(`/api/rounds/${roundId}/lineup`, {data: {teams: teams.map((t) => ({team_id: t.id, player_ids: t.selected}))}});
  expect(saved.ok(), `lineup: ${await saved.text()}`).toBeTruthy();
  const match = await api.post("/api/ongoing-matches", {data: {round_id: roundId, score_threshold: MATCH_THRESHOLD}});
  expect(match.ok(), `match: ${await match.text()}`).toBeTruthy();
  return ((await match.json()) as {id: number}).id;
}

// Hands saved as another phone at the table saves them; returns their ids
export async function addHands(api: APIRequestContext, matchId: number, hands: ApiHand[]): Promise<number[]> {
  const ids: number[] = [];
  for (const h of hands) {
    const count = (side: 1 | 2, value: Zvanje) => (h.zvanja?.[side] ?? []).filter((z) => z === value).length;
    const res = await api.post("/api/ongoing-result", {
      data: {
        match_id: matchId,
        team1_game_points: h.points[0],
        team2_game_points: h.points[1],
        team1_zvanja3: count(1, 3),
        team1_zvanja4: count(1, 4),
        team2_zvanja3: count(2, 3),
        team2_zvanja4: count(2, 4),
        custom: h.custom ?? false,
        dosta_side: h.dosta ?? null,
      },
    });
    expect(res.ok(), `hand: ${await res.text()}`).toBeTruthy();
    ids.push(((await res.json()) as {result_id: number}).result_id);
  }
  return ids;
}

// Vrijeme partije: a match started now, with a deadline `minutes` away. The seeded open matches carry no deadline (the
// generator drops it, so nothing closes by time while a section works); a test that looks at the clock, or closes a
// match by time, gives its match one first. A match closed meanwhile throws.
export async function freshClock(db: Db, matchId: number, minutes = 45) {
  const now = new Date();
  const {count} = await db.ongoingMatch.updateMany({where: {id: matchId}, data: {started_at: now, ends_at: new Date(now.getTime() + minutes * 60_000)}});
  if (count !== 1) throw new Error(`match ${matchId} is no longer open (closed by time or finished before this test): reseed with e2e/local/app.sh`);
}

// A saved hand as the scorepad loads it, to put back with putHand after a test changed it
export type SavedHand = {
  result_id: number;
  match_id: number;
  team1_game_points: number;
  team2_game_points: number;
  team1_zvanja3?: number;
  team1_zvanja4?: number;
  team2_zvanja3?: number;
  team2_zvanja4?: number;
  custom?: boolean;
  dosta_side?: 1 | 2 | null;
};

export async function savedHand(api: APIRequestContext, resultId: number): Promise<SavedHand> {
  const res = await api.get(`/api/ongoing-result/${resultId}`);
  expect(res.ok(), `hand ${resultId}: ${await res.text()}`).toBeTruthy();
  return (await res.json()) as SavedHand;
}

// Saves the hand as it was (the server moves the match score by the difference), as a phone's correction does
export async function putHand(api: APIRequestContext, hand: SavedHand) {
  const {result_id, ...fields} = hand;
  const res = await api.put(`/api/ongoing-result/${result_id}`, {data: fields});
  expect(res.ok(), `put back hand ${result_id}: ${await res.text()}`).toBeTruthy();
}

// Removes every round of the league's night, drafts too, with what was played at them, as the admin's Kola tab does:
// the server recounts the standings and replays the ratings, so the world is as the seed left it
export async function removeNight(admin: APIRequestContext, leagueId: number, night: string) {
  const list = await admin.get(`/api/admin/leagues/${leagueId}/rounds`);
  expect(list.ok(), `rounds: ${await list.text()}`).toBeTruthy();
  const rounds = (await list.json()) as {date: string; roundNumber: number}[];
  for (const r of rounds.filter((r) => r.date === night)) {
    const res = await admin.delete(`/api/admin/leagues/${leagueId}/rounds?date=${night}&round_number=${r.roundNumber}`);
    expect(res.ok(), `delete Kolo ${r.roundNumber}: ${await res.text()}`).toBeTruthy();
  }
}
