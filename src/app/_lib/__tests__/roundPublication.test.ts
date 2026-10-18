import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {test} from "node:test";
import {
  approvalStatus,
  draftCounts,
  draftLetter,
  draftLetters,
  NOTHING_APPROVED,
  publishedAtLabel,
  publishedTimeLabel,
  publishLabel,
  publishNote,
  publishNumbers,
  PUBLISHED_ROUND,
  ROUND_ALREADY_PUBLISHED,
  roundName,
  RoundStatus,
  roundStatusOf,
  roundsToApprove,
  roundsToDiscard,
  roundsToPublish,
  visibleRounds,
} from "../roundStatus";

// Kola se objavljuju tek nakon odobrenja: Novo kolo creates drafts, an admin approves them and publishes the approved
// ones; players see published rounds only.

test("approving: a draft becomes approved, again changes nothing; a published round can't change", () => {
  assert.deepEqual(approvalStatus("DRAFT", true), {status: "APPROVED"});
  assert.deepEqual(approvalStatus("APPROVED", true), {status: "APPROVED"});
  assert.deepEqual(approvalStatus("PUBLISHED", true), {error: ROUND_ALREADY_PUBLISHED});
});

test("taking an approval back: approved becomes a draft, a draft stays one; a published round can't change", () => {
  assert.deepEqual(approvalStatus("APPROVED", false), {status: "DRAFT"});
  assert.deepEqual(approvalStatus("DRAFT", false), {status: "DRAFT"});
  assert.deepEqual(approvalStatus("PUBLISHED", false), {error: ROUND_ALREADY_PUBLISHED});
});

test("publishing takes the approved rounds only: drafts stay drafts, published ones aren't published again", () => {
  const night = [
    {round: 4, status: "PUBLISHED" as RoundStatus},
    {round: 5, status: "APPROVED" as RoundStatus},
    {round: 6, status: "DRAFT" as RoundStatus},
    {round: 7, status: "APPROVED" as RoundStatus},
  ];
  assert.deepEqual(roundsToPublish(night).map((r) => r.round), [5, 7]);
  assert.deepEqual(roundsToPublish(night.filter((r) => r.status !== "APPROVED")), [], NOTHING_APPROVED);
});

test("Odobri sva approves the drafts only: approved and published rounds stay as they are", () => {
  const night = [
    {round: 1, status: "PUBLISHED" as RoundStatus},
    {round: 2, status: "APPROVED" as RoundStatus},
    {round: 3, status: "DRAFT" as RoundStatus},
    {round: 4, status: "DRAFT" as RoundStatus},
  ];
  assert.deepEqual(roundsToApprove(night).map((r) => r.round), [3, 4]);
  // then only approved rounds go out: the ones approved now and the one approved before
  const approved = night.map((r) => (roundsToApprove(night).includes(r) ? {...r, status: "APPROVED" as RoundStatus} : r));
  assert.deepEqual(roundsToPublish(approved).map((r) => r.round), [2, 3, 4]);
  assert.deepEqual(roundsToApprove([{status: "PUBLISHED" as RoundStatus}, {status: "APPROVED" as RoundStatus}]), []);
});

test("the phone's Skica says when the rounds went out, in league time", () => {
  assert.equal(publishedTimeLabel("2026-10-15T16:42:00.000Z"), "18:42");
  assert.equal(publishedTimeLabel("2026-01-15T17:05:00.000Z"), "18:05");
});

test("discarding the draft deletes every round not published yet, approved ones too; published rounds stay", () => {
  const night = [
    {round: 1, status: "PUBLISHED" as RoundStatus},
    {round: 2, status: "APPROVED" as RoundStatus},
    {round: 3, status: "DRAFT" as RoundStatus},
  ];
  assert.deepEqual(roundsToDiscard(night).map((r) => r.round), [2, 3]);
  assert.deepEqual(roundsToDiscard([{status: "PUBLISHED" as RoundStatus}]), []);
});

test("a round's status from its tables", () => {
  const t = (...s: RoundStatus[]) => s.map((status) => ({status}));
  assert.equal(roundStatusOf(t("DRAFT", "DRAFT")), "DRAFT");
  assert.equal(roundStatusOf(t("APPROVED", "APPROVED")), "APPROVED");
  assert.equal(roundStatusOf(t("PUBLISHED", "PUBLISHED")), "PUBLISHED");
  // tables always share it; if they ever don't, the round isn't published until every table is
  assert.equal(roundStatusOf(t("PUBLISHED", "APPROVED")), "APPROVED");
  assert.equal(roundStatusOf(t("APPROVED", "DRAFT")), "DRAFT");
  assert.equal(roundStatusOf([]), "DRAFT");
});

test("a player (or a visitor) reads published rounds only, an admin every round", () => {
  assert.deepEqual(visibleRounds(false), {status: "PUBLISHED"});
  assert.deepEqual(visibleRounds(true), {});
  assert.deepEqual(PUBLISHED_ROUND, {status: "PUBLISHED"});
});

test("the publish button and its note (design drVals)", () => {
  const counts = (...s: RoundStatus[]) => draftCounts(s.map((status) => ({status})));
  // nothing approved: the button can't publish anything
  let c = counts("DRAFT", "DRAFT", "DRAFT");
  assert.deepEqual(c, {total: 3, published: 0, approved: 0, unpublished: 3});
  assert.equal(publishLabel(c), "Objavi odobrena kola · 0/3");
  assert.equal(publishNote(c), "Odobri barem jedno kolo da ga možeš objaviti.");
  c = counts("APPROVED", "DRAFT", "DRAFT");
  assert.equal(publishLabel(c), "Objavi odobrena kola · 1/3");
  assert.equal(publishNote(c), "Neodobrena kola ostaju u skici.");
  // Kolo 1 published, Kolo 2 approved (design "partial")
  c = counts("PUBLISHED", "APPROVED", "DRAFT");
  assert.equal(publishLabel(c), "Objavi odobrena kola · 1/2");
  assert.equal(publishNote(c), "Objavljeno 1 od 3 kola. Ostala igrači još ne vide.");
  assert.deepEqual(counts("PUBLISHED", "PUBLISHED"), {total: 2, published: 2, approved: 0, unpublished: 0});
});

test("the publish time is in league time", () => {
  // winter (UTC+1) and summer (UTC+2)
  assert.equal(publishedAtLabel("2026-02-24T17:42:00.000Z"), "24.02. u 18:42");
  assert.equal(publishedAtLabel("2026-10-13T18:05:00.000Z"), "13.10. u 20:05");
  assert.equal(publishedAtLabel("2026-10-13T22:30:00.000Z"), "14.10. u 00:30");
});

// --- Static scan: everything players and visitors read leaves unpublished rounds out --------------------------------

const APP = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(APP, path), "utf8");

test("the player-facing reads of rounds filter out the unpublished ones", () => {
  // file → why it must filter
  const reads: Record<string, string> = {
    "api/rounds/route.ts": "Dnevni poredak's tables, the menu's live dot",
    "_lib/service/round/getById.ts": "a table on Početna, the scoreboard",
    "api/rounds/[id]/matches/route.ts": "a table's matches",
    "_lib/service/round/getLastOpenByPlayerId.ts": "Početna's Nastavi igru, table and opponent; Započni igru",
    "_lib/service/auth/requireUser.ts": "canPlayRound: nobody plays a draft",
    "_lib/service/league/getRoundDatesById.ts": "Dnevni poredak's nights, the +/− nights",
    "_lib/service/league/nights.ts": "Raspored's played nights",
    "_lib/service/league/leagues.ts": "which league is being played",
    "_lib/service/league/getStandings.ts": "the +/− table after the previous night",
    "_lib/service/team/overview.ts": "a team's last nights",
  };
  const marker = /PUBLISHED_ROUND|visibleRounds\(|status = 'PUBLISHED'/;
  for (const [file, why] of Object.entries(reads)) assert.match(read(file), marker, `${file} (${why})`);
});

test("the standings in the database count published rounds only", () => {
  const dir = join(APP, "..", "..", "prisma", "migrations");
  const migrations = readdirSync(dir).filter((d) => /^\d{14}_/.test(d)).sort();
  // the newest definition of each standings routine
  const latest = (name: string) => {
    const sql = migrations.map((m) => readFileSync(join(dir, m, "migration.sql"), "utf8")).filter((s) => s.includes(name)).pop();
    assert.ok(sql, name);
    const start = sql.indexOf(name);
    const end = sql.indexOf("$$;", sql.indexOf("$$", start) + 2);
    return sql.slice(start, end);
  };
  // update_team_score: two queries of two branches each; get_league_standings_by_date: the same
  for (const name of ["PROCEDURE update_team_score", "FUNCTION get_league_standings_by_date"]) {
    const body = latest(name);
    const rounds = body.match(/FROM "Round" r/g)?.length ?? 0;
    const published = body.match(/r\.status = 'PUBLISHED'/g)?.length ?? 0;
    assert.ok(rounds >= 4, `${name}: ${rounds} round queries`);
    assert.equal(published, rounds, `${name}: every round query filters published rounds`);
  }
});

// A round waiting in Skica has no number: Skica A, B, C… until it is published, and then the next Kolo number

const r = (roundNumber: number, status: RoundStatus, draftOrder: number | null = null) => ({roundNumber, status, draftOrder});

test("a draft is called by its letter, a published round by its number", () => {
  assert.equal(draftLetter(1), "A");
  assert.equal(draftLetter(3), "C");
  assert.equal(roundName({roundNumber: 12, letter: "B"}), "Skica B");
  assert.equal(roundName({roundNumber: 7, letter: null}), "Kolo 7");
});

test("a night's drafts keep their letters: a published round has none, and the others don't move up", () => {
  const letters = draftLetters([r(9, "PUBLISHED"), r(10, "DRAFT", 1), r(12, "APPROVED", 3)]);
  assert.equal(letters.get(9), undefined);
  assert.equal(letters.get(10), "A");
  assert.equal(letters.get(12), "C");
  // drafts from before draft orders: by their place among the night's drafts
  const old = draftLetters([r(4, "PUBLISHED"), r(5, "DRAFT"), r(6, "DRAFT")]);
  assert.deepEqual([old.get(5), old.get(6)], ["A", "B"]);
});

test("publishing only the last of three drafts makes it the next round, with no gap", () => {
  const numbers = publishNumbers([r(9, "DRAFT", 1), r(10, "DRAFT", 2), r(11, "APPROVED", 3)], 8);
  assert.equal(numbers.get(11), 9);
  // the drafts left come after it, unseen
  assert.equal(numbers.get(9), 10);
  assert.equal(numbers.get(10), 11);
});

test("approved rounds are numbered in their letter order after the league's last published round", () => {
  const numbers = publishNumbers([r(20, "APPROVED", 3), r(18, "APPROVED", 1), r(19, "DRAFT", 2)], 4);
  assert.deepEqual([numbers.get(18), numbers.get(20), numbers.get(19)], [5, 6, 7]);
});

