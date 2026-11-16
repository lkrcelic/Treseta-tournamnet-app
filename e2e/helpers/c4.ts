// C4's own setup and checks: Vrijeme partije. The seeded table tables.timeLimit (league "E2E · Scorepad", Meč 1 in play
// with 3 hands) on a fresh clock before a test and put back as it was after it, a match's deadline moved in the
// database, /api/cron/tick for the test's own table alone, the scorepad's countdown read against the database, and a
// hand typed up to Spremi (scorepad.ts's enterHand expects the board to list the hand, which a hand refused or a hand
// that ends the match never does).
// Tables of the test's own come from C1's `night` fixture ("E2E · Novo kolo", tonight emptied before and after).
import {expect, type APIRequestContext, type Page} from "@playwright/test";
import {handTotals, type PlayedHand} from "@/app/_lib/game/scoring";
import {CRON_HEADERS, type Db} from "./db";
import {test as base} from "./c1";
import {escape} from "./scorepad";

// Vrijeme partije of the E2E leagues (the default, 45 minutes), and what each raise of the target adds (BELA_SYNC.md ·
// Turniri: "45 minutes by default … and five minutes more for every raise of the target")
export const GAME_MINUTES = 45;
export const RAISE_MINUTES = 5;
export const MINUTE = 60_000;

// What the server answers a player's hand saved after the time is up (service/ongoingResult/create.ts, TIME_UP)
export const TIME_UP = "Vrijeme partije je isteklo. Partija se zatvara s upisanim rezultatom.";

// tables.timeLimit as a test gets it: Meč 1 open with the seeded hands, 45 minutes left
export type TimeLimitTable = {
  roundId: number;
  matchId: number;
  // a team1 player: team1 is on the left of the board
  phone: string;
  team1: string;
  team2: string;
  // the seeded hands' score and count, by the round's sides
  score: [number, number];
  hands: number;
};

type SeededHand = Omit<PlayedHand, "dosta_side"> & {result_id?: number; custom: boolean; dosta_side: number | null};

// Meč 1 of tables.timeLimit as the seed left it: its hands and its clock
type Seeded = {
  roundId: number;
  matchId: number;
  active: boolean;
  score_threshold: number | null;
  match_date: Date | null;
  start_time: Date | null;
  started_at: Date | null;
  ends_at: Date | null;
  hands: SeededHand[];
};

export const test = base.extend<{timeLimit: TimeLimitTable}>({
  timeLimit: async ({db, world}, use) => {
    const {roundId, matchId, team1} = world.tables.timeLimit;
    const seeded = await seededTable(db, roundId, matchId!);
    const now = Date.now();
    await resetTable(db, seeded, {started_at: new Date(now), ends_at: new Date(now + GAME_MINUTES * MINUTE)});
    const round = await db.round.findUniqueOrThrow({where: {id: roundId}, include: {team1: true, team2: true}});
    const score = seeded.hands.map(handTotals).reduce<[number, number]>(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
    await use({roundId, matchId: matchId!, phone: team1[0], team1: round.team1.team_name, team2: round.team2.team_name, score, hands: seeded.hands.length});
    await resetTable(db, seeded, {started_at: seeded.started_at, ends_at: seeded.ends_at});
  },
});

export {expect} from "./c1";

// The seeded Meč 1: the open match, or, when a read after its seeded deadline closed it by time (the world's open
// matches were started when it was seeded), the finished match it became
async function seededTable(db: Db, roundId: number, matchId: number): Promise<Seeded> {
  const round = await db.round.findUniqueOrThrow({where: {id: roundId}});
  if (!round.open) throw new Error(`tables.timeLimit (round ${roundId}) was played to the end, standings and all: reseed with e2e/local/app.sh`);
  const open = await db.ongoingMatch.findUnique({where: {id: matchId}, include: {results: {orderBy: {result_id: "asc"}}}});
  if (open) {
    return {
      roundId,
      matchId,
      active: round.active,
      score_threshold: open.score_threshold,
      match_date: open.match_date,
      start_time: open.start_time,
      started_at: open.started_at,
      ends_at: open.ends_at,
      hands: open.results.map(({match_id: _, ...hand}) => hand),
    };
  }
  const first = await db.match.findFirst({where: {round_id: roundId}, orderBy: {id: "asc"}, include: {results: {orderBy: {result_id: "asc"}}}});
  if (!first?.start_time) throw new Error(`tables.timeLimit (round ${roundId}) has neither its open match ${matchId} nor a finished one: reseed with e2e/local/app.sh`);
  return {
    roundId,
    matchId,
    active: true,
    score_threshold: first.score_threshold,
    match_date: first.match_date,
    start_time: first.start_time,
    started_at: first.start_time,
    ends_at: new Date(first.start_time.getTime() + GAME_MINUTES * MINUTE),
    hands: first.results.map(({match_id: _, result_id: __, ...hand}) => hand),
  };
}

// The table back at Meč 1 in play with the seeded hands and this clock: what the test (or a read after the seeded
// deadline) finished goes, and so do the round's wins
async function resetTable(db: Db, s: Seeded, clock: {started_at: Date | null; ends_at: Date | null}) {
  const [score1, score2] = s.hands.map(handTotals).reduce<[number, number]>(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
  await db.$transaction(async (tx) => {
    await tx.match.deleteMany({where: {round_id: s.roundId}});
    await tx.ongoingMatch.deleteMany({where: {round_id: s.roundId}});
    await tx.ongoingMatch.create({
      data: {
        id: s.matchId,
        round_id: s.roundId,
        score_threshold: s.score_threshold,
        player_pair1_score: score1,
        player_pair2_score: score2,
        match_date: s.match_date,
        start_time: s.start_time,
        ...clock,
        results: {create: s.hands},
      },
    });
    await tx.round.update({where: {id: s.roundId}, data: {team1_wins: 0, team2_wins: 0, open: true, active: s.active}});
  });
}

// Moves a match's clock so that its time is up at `endsAt`. Its start moves with it, so the match keeps its length (its
// minutes and raises), and a hand saved later puts the deadline where the hands say from the moved start.
export async function moveDeadline(db: Db, matchId: number, endsAt: Date) {
  const m = await db.ongoingMatch.findUniqueOrThrow({where: {id: matchId}});
  if (!m.started_at || !m.ends_at) throw new Error(`match ${matchId} has no Vrijeme partije`);
  const shift = endsAt.getTime() - m.ends_at.getTime();
  await db.ongoingMatch.update({where: {id: matchId}, data: {ends_at: endsAt, started_at: new Date(m.started_at.getTime() + shift)}});
}

// /api/cron/tick as the scheduler calls it, with only this table's match out of time: every other open match whose
// time is up (or soon is: the world's were started when it was seeded) has no deadline for the call and gets its own
// back afterwards, so the tick closes nothing another test needs. Returns the tables it closed.
export async function tickFor(guest: APIRequestContext, db: Db, roundId: number): Promise<number[]> {
  const others = await db.ongoingMatch.findMany({
    where: {ends_at: {lt: new Date(Date.now() + 5 * MINUTE)}, OR: [{round_id: null}, {round_id: {not: roundId}}]},
    select: {id: true, ends_at: true},
  });
  await db.ongoingMatch.updateMany({where: {id: {in: others.map((m) => m.id)}}, data: {ends_at: null}});
  try {
    const res = await guest.get("/api/cron/tick", {headers: CRON_HEADERS});
    expect(res.ok(), `tick: ${res.status()} ${await res.text()}`).toBeTruthy();
    return ((await res.json()) as {closed_tables: number[]}).closed_tables;
  } finally {
    for (const m of others) await db.ongoingMatch.updateMany({where: {id: m.id}, data: {ends_at: m.ends_at}});
  }
}

// "Do kraja partije 2:59" → 179 000 ms
export function clockMs(text: string): number {
  const m = text.match(/(\d+):(\d\d)/);
  if (!m) throw new Error(`no time in "${text}"`);
  return (Number(m[1]) * 60 + Number(m[2])) * 1000;
}

// The countdown beside the target shows what the database gives the match: ends_at less now (0:00 once it is up),
// give or take 3 s (the board ticks once a second, on the server's clock as it read it when it loaded)
export async function expectClock(page: Page, endsAt: Date) {
  const timer = page.getByRole("timer");
  await expect(timer).toBeVisible();
  await expect(async () => {
    const label = (await timer.getAttribute("aria-label")) ?? "";
    expect(label).toMatch(/^Do kraja partije \d+:\d\d$/);
    const left = Math.max(0, endsAt.getTime() - Date.now());
    expect(Math.abs(clockMs(label) - left), `"${label}", the database says ${Math.round(left / 1000)} s`).toBeLessThanOrEqual(3000);
  }).toPass({timeout: 10_000});
}

// "#BC4749" → "rgb(188, 71, 73)", as the browser reports a colour
export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// Upiši igru, Nema zvanja, and on the keypad `points` for `team` (the other team gets the rest of 11): the hand ready
// for Spremi, which the test presses
export async function typeHand(page: Page, hand: {team: string; points: number}) {
  const add = page.getByRole("button", {name: "Upiši igru", exact: true});
  await expect(add).toBeVisible();
  await add.click();
  await expect(page.getByRole("radiogroup", {name: "Zvanja: upis za ekipu"})).toBeVisible();
  await page.getByRole("button", {name: "Nema zvanja", exact: true}).click();
  const keypad = page.getByRole("group", {name: "Bodovi igre"});
  await expect(keypad).toBeVisible();
  const box = page.getByRole("radiogroup", {name: "Igra: upis za ekipu"}).getByRole("radio", {name: new RegExp(`^${escape(hand.team)}: igra \\d+`)});
  await box.click();
  await expect(box).toBeChecked();
  for (const d of String(hand.points)) await keypad.getByRole("button", {name: d, exact: true}).click();
  await expect(box).toHaveAccessibleName(new RegExp(`^${escape(hand.team)}: igra ${hand.points}(,|$)`));
}
