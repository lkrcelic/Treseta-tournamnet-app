import {test} from "node:test";
import assert from "node:assert/strict";
import type {RatingRow} from "@/app/_interfaces/ratings";
import {formatChange, nightResult, ratingChart, ratingIdFromPath, ratingPath, RATINGS_PAGE, roundsLabel, shortDate, visibleRatings} from "@/app/_lib/ui/ratings";
import {loadMoreLabel, NOUN} from "@/app/_lib/ui/text";

test("changes read +18, −12, 0, and — before the first night", () => {
  assert.equal(formatChange(18), "+18");
  assert.equal(formatChange(-12), "−12");
  assert.equal(formatChange(0), "0");
  assert.equal(formatChange(null), "—");
});

test("rounds use kolo / kola", () => {
  assert.deepEqual([0, 1, 2, 5, 11, 21, 22].map(roundsLabel), ["0 kola", "1 kolo", "2 kola", "5 kola", "11 kola", "21 kolo", "22 kola"]);
});

test("dates and night results", () => {
  assert.equal(shortDate("2026-02-07"), "07.02.");
  assert.deepEqual(nightResult(5, 1), {label: "5:1", tone: "up"});
  assert.deepEqual(nightResult(1, 1), {label: "1:1", tone: "flat"});
  assert.deepEqual(nightResult(0, 2), {label: "0:2", tone: "down"});
});

test("the chart starts at 1500 on the left and ends at the current rating on the right", () => {
  const c = ratingChart([1540, 1520, 1600], 300, 100);
  assert.ok(c.line.startsWith("M0 "));
  assert.equal(c.end.x, 300);
  // higher ratings are higher up (smaller y); 1500 is the lowest value here
  assert.ok(c.end.y < c.baseY);
  assert.ok(c.area.endsWith("L300 100 Z"));
});

// n players, highest rating first (rating(i) must not go up); equal ratings share a rank, as on Rejting
function ratingList(n: number, names: (i: number) => string = (i) => `Igrač ${i + 1}`, rating: (i: number) => number = (i) => 2000 - i): RatingRow[] {
  const rows: RatingRow[] = [];
  for (let i = 0; i < n; i++) {
    const prev = rows[i - 1];
    const r = rating(i);
    rows.push({id: 100 + i, rank: prev && prev.rating === r ? prev.rank : i + 1, name: names(i), team: null, rating: r, change: 0, rounds: 9, provisional: false});
  }
  return rows;
}

test("Rejting shows 50 rows a page, and Učitaj još counts what is left", () => {
  assert.equal(RATINGS_PAGE, 50);
  const list = ratingList(127);
  const one = visibleRatings(list, "", 1);
  assert.equal(one.shown.length, RATINGS_PAGE);
  assert.equal(one.matched, 127);
  assert.equal(one.left, 77);
  assert.deepEqual(one.shown.map((p) => p.id), list.slice(0, RATINGS_PAGE).map((p) => p.id));
  assert.equal(visibleRatings(list, "", 2).left, 27);
  assert.equal(visibleRatings(list, "", 3).left, 0);
  assert.equal(visibleRatings(list, "", 3).shown.length, 127);
  assert.equal(visibleRatings(ratingList(12), "", 1).left, 0);
  assert.deepEqual(visibleRatings([], "", 1), {shown: [], matched: 0, left: 0});
});

test("without a search the first page reaches the viewer's row (and a linked player), rounded up to ten", () => {
  const list = ratingList(227);
  // me 139th on the list: 140 rows, then pages of 50
  const meId = list[138].id;
  assert.equal(visibleRatings(list, "", 1, [meId]).shown.length, 140);
  assert.equal(visibleRatings(list, "", 2, [meId]).shown.length, 190);
  // the place on the list counts, not the shared rank: the 131st to 142nd share #131, the 141st is on a page of 150
  const tied = ratingList(160, undefined, (i) => (i >= 130 && i <= 141 ? 1700 : 2000 - i));
  assert.equal(tied[140].rank, 131);
  const reached = visibleRatings(tied, "", 1, [tied[140].id]).shown;
  assert.equal(reached.length, 150);
  assert.equal(reached[reached.length - 10].id, tied[140].id);
  // a row in the first page, or nobody to keep: just the page
  assert.equal(visibleRatings(list, "", 1, [list[3].id, null, undefined]).shown.length, RATINGS_PAGE);
  assert.equal(visibleRatings(list, "", 1, [999999]).shown.length, RATINGS_PAGE);
  // the lowest of the kept rows
  assert.equal(visibleRatings(list, "", 1, [list[60].id, list[201].id]).shown.length, 210);
  // a search pages from the first match
  assert.equal(visibleRatings(list, "igrač", 1, [meId]).shown.length, RATINGS_PAGE);
});

test("the search finds names, ignores case and diacritics, and keeps each player's place", () => {
  const names = ["Petar Šimić", "Ivan Perić", "Marko Marković", "Đuro Đurić", "Ana Simić"];
  const list = ratingList(5, (i) => names[i]);
  const hits = visibleRatings(list, "  SIM ", 1);
  assert.deepEqual(hits.shown.map((p) => p.name), ["Petar Šimić", "Ana Simić"]);
  assert.deepEqual(hits.shown.map((p) => p.rank), [list[0].rank, list[4].rank]);
  assert.equal(hits.matched, 2);
  assert.equal(visibleRatings(list, "duro", 1).shown[0].name, "Đuro Đurić");
  assert.deepEqual(visibleRatings(list, "xyz", 1), {shown: [], matched: 0, left: 0});
  // 60 matches of 127: a page, then the rest
  const many = ratingList(127, (i) => (i % 2 ? `Horvat ${i}` : `Kovač ${i}`));
  const page = visibleRatings(many, "horvat", 1);
  assert.equal(page.matched, 63);
  assert.equal(page.left, 13);
  assert.ok(page.shown.every((p) => p.name.startsWith("Horvat")));
});

test("Učitaj još · još N igrača", () => {
  assert.deepEqual([1, 2, 5, 11, 21, 22].map((n) => loadMoreLabel(n, NOUN.igrač)), [
    "Učitaj još · još 1 igrač",
    "Učitaj još · još 2 igrača",
    "Učitaj još · još 5 igrača",
    "Učitaj još · još 11 igrača",
    "Učitaj još · još 21 igrač",
    "Učitaj još · još 22 igrača",
  ]);
  // the count in the label is what visibleRatings leaves
  assert.equal(loadMoreLabel(visibleRatings(ratingList(71), "", 1).left, NOUN.igrač), "Učitaj još · još 21 igrač");
});

test("a rating's address", () => {
  assert.equal(ratingPath(42), "/ratings/42");
  assert.equal(ratingIdFromPath("/ratings/42"), 42);
  assert.equal(ratingIdFromPath("/ratings/42/"), 42);
  assert.equal(ratingIdFromPath("/ratings"), null);
  assert.equal(ratingIdFromPath("/ratings/abc"), null);
  assert.equal(ratingIdFromPath("/players/42"), null);
  assert.equal(ratingIdFromPath(null), null);
});
