// C2's own setup and steps: tables.twoPhones (league "E2E · Scorepad": the first match open with 2 hands) seen from
// both phones of team1, and a hand entered up to Spremi without pressing it, so two phones can have the same hand open
// at once. scorepad.ts's enterHand and correctHand do the whole entry in one go; the steps they are built from aren't
// exported, so the few C2 needs to stop before Spremi are written again here (zvanjaStep, pointsStep).
import {expect, type Locator, type Page} from "@playwright/test";
import {test as base} from "./fixtures";
import {escape, freshClock, handRows, putHand, savedHand, type Hand, type SavedHand} from "./scorepad";

export type TwoPhones = {
  roundId: number;
  matchId: number;
  // team1's two players: both phones show team1 on the left of the board
  phones: [string, string];
  team1: string;
  team2: string;
  // the hands as the seed saved them, in order
  hands: SavedHand[];
};

export const test = base.extend<{twoPhones: TwoPhones}>({
  // The match on a fresh clock before the test; afterwards every seeded hand put back as it was and every hand the test
  // added deleted, as the admin's scorepad deletes one (the server moves the score back), so the next test starts from
  // the seed's two hands again
  twoPhones: async ({api, db, world}, use) => {
    const {roundId, matchId, team1} = world.tables.twoPhones;
    if (team1.length < 2) throw new Error(`tables.twoPhones: team1 has ${team1.length} active players, two phones need two`);
    await freshClock(db, matchId!);
    const phone = await api(team1[0]);
    const admin = await api("admin");
    const round = await db.round.findUniqueOrThrow({where: {id: roundId}, include: {team1: true, team2: true}});
    const ids = await db.ongoingResult.findMany({where: {match_id: matchId}, orderBy: {result_id: "asc"}, select: {result_id: true}});
    if (ids.length !== 2) throw new Error(`tables.twoPhones has ${ids.length} hands, the seed saves 2: a run was cut short, reseed with e2e/local/app.sh`);
    const hands: SavedHand[] = [];
    for (const {result_id} of ids) hands.push(await savedHand(phone, result_id));

    await use({roundId, matchId: matchId!, phones: [team1[0], team1[1]], team1: round.team1.team_name, team2: round.team2.team_name, hands});

    for (const hand of hands) await putHand(phone, hand);
    const kept = new Set(hands.map((h) => h.result_id));
    const added = await db.ongoingResult.findMany({where: {match_id: matchId, result_id: {notIn: [...kept]}}, select: {result_id: true}});
    for (const {result_id} of added) {
      const res = await admin.delete(`/api/admin/hands/ongoing/${result_id}`);
      expect(res.ok(), `delete hand ${result_id}: ${await res.text()}`).toBeTruthy();
    }
  },
});

export {expect} from "./fixtures";

// ---------- a hand up to Spremi ----------

const zvanjaBoxes = (page: Page) => page.getByRole("radiogroup", {name: "Zvanja: upis za ekipu"});
const pointsBoxes = (page: Page) => page.getByRole("radiogroup", {name: "Igra: upis za ekipu"});
const keypadOf = (page: Page) => page.getByRole("group", {name: "Bodovi igre"});

// whether the app has stored the logged-in user (refreshUser, on every app load; the store is persisted as "auth-store")
export const userStored = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem("auth-store") ?? "null") as {state?: {user?: {id?: number} | null}} | null)?.state?.user?.id ?? null);

// Opens the match's board as a phone that logged in through Prijava. as() logs in through the API, so the app's first
// load finds no stored user, and refreshUser then drops the stored match: when /api/auth/me answers after the board
// fetched it, the board shows no hands until its next refresh, 15 s later (once in 20 runs here). Prijava stores the
// user before any board opens, so: the first load until the user is stored, then the board again. Belongs in as().
export async function openBoard(page: Page, matchId: number) {
  await page.goto(`/ongoing-match/${matchId}`);
  await expect.poll(() => userStored(page)).not.toBeNull();
  await page.reload();
}

// Upiši igru on the board: resolves on the entry's first step
export async function openEntry(page: Page) {
  const add = page.getByRole("button", {name: "Upiši igru", exact: true});
  await expect(add).toBeVisible();
  await add.click();
  await expect(zvanjaBoxes(page).or(pointsBoxes(page))).toBeVisible();
}

// Zvanja (both teams' replaced by `hand.zvanja`, a team left out has none) and Igra (`points` for `team` on the keypad,
// the other team gets the rest of 11) of a hand opened with openEntry, or a saved one opened with scorepad.ts's
// openHand; resolves on Igra with Spremi not pressed. A normal hand only: Ručno is C1's (enterCustom).
export async function fillHand(page: Page, hand: Hand) {
  const boxes = zvanjaBoxes(page);
  await expect(boxes).toBeVisible();
  const teams = await teamsOf(boxes, "zvanja");
  const unknown = Object.keys(hand.zvanja ?? {}).filter((t) => !teams.includes(t));
  if (unknown.length) throw new Error(`no team ${unknown.join(", ")} at this table (${teams.join(", ")})`);
  for (const team of teams) {
    const box = boxes.getByRole("radio", {name: new RegExp(`^${escape(team)}: zvanja \\d+$`)});
    await box.click();
    await expect(box).toBeChecked();
    const buttons = page.getByRole("group", {name: `Zvanja: ${team}`});
    await buttons.getByRole("button", {name: "Obriši zvanja"}).click();
    const list = hand.zvanja?.[team] ?? [];
    for (const z of list) await buttons.getByRole("button", {name: new RegExp(`^Zvanje ${z}(,|$)`)}).click();
    await expect(box).toHaveAccessibleName(`${team}: zvanja ${list.reduce((s, z) => s + z, 0)}`);
  }
  await page.getByRole("button", {name: /^(Dalje|Nema zvanja)$/}).click();

  const keypad = keypadOf(page);
  await expect(keypad).toBeVisible();
  await keypad.getByRole("button", {name: "Obriši bodove"}).click();
  const box = pointsBoxes(page).getByRole("radio", {name: new RegExp(`^${escape(hand.team)}: igra \\d+`)});
  await box.click();
  await expect(box).toBeChecked();
  for (const d of String(hand.points)) await keypad.getByRole("button", {name: d, exact: true}).click();
  await expect(box).toHaveAccessibleName(new RegExp(`^${escape(hand.team)}: igra ${hand.points}(,|$)`));
}

// Spremi on a filled hand; resolves with the server's answer to the save (the new hand's POST, a correction's PUT)
export async function pressSave(page: Page) {
  const [answer] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname.startsWith("/api/ongoing-result") && ["POST", "PUT"].includes(r.request().method())),
    page.getByRole("button", {name: "Spremi", exact: true}).click(),
  ]);
  return answer;
}

// Back on the board after a save: `count` hands listed
export async function expectBoard(page: Page, count: number) {
  await expect(keypadOf(page)).toBeHidden();
  await expect(handRows(page)).toHaveCount(count);
}

// The phone's question when another phone saved a hand while this one was entering its own (Bela 3efe0f4, DECISIONS
// #91; in Treseta's own hand entry on bela-sync, a03b1ade)
export const sameHandQuestion = (page: Page): Locator => page.getByRole("dialog", {name: "Je li ovo nova igra?"});

// the two team names of a step's boxes ("Purgeri: zvanja 7" → "Purgeri")
async function teamsOf(boxes: Locator, label: string): Promise<string[]> {
  const names = await boxes.getByRole("radio").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  return names.map((n) => n.replace(new RegExp(`: ${label} \\d+(,.*)?$`), ""));
}
