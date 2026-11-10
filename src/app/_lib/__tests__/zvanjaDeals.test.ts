import {test} from "node:test";
import assert from "node:assert/strict";
import {NO_ZVANJA, ZVANJA_DEALS, ZvanjaCounts, zvanjaError} from "@/app/_lib/game/scoring";

// Where scoring.ts's ZVANJA_DEALS comes from, counted again: every deal of the 12 cards that make zvanja (A, 2 and 3 of
// the four suits) to the four players, at most 10 each (the other 28 cards fill the hands up). Players 0 and 1 are
// team 1, players 2 and 3 team 2. A card counts in every zvanje it is part of.

// card i: rank Math.floor(i / 4) (3, 2, A), suit i % 4
const CARDS = 12;
const bits = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};

// a player's zvanja for each set of the 12 cards they may hold: [threes, fours]
const PLAYER_ZVANJA: [number, number][] = Array.from({length: 1 << CARDS}, (_, m) => {
  let threes = 0;
  let fours = 0;
  for (let rank = 0; rank < 3; rank++) {
    const n = bits((m >> (rank * 4)) & 0b1111);
    if (n === 4) fours++;
    else if (n === 3) threes++;
  }
  // napola: A, 2 and 3 of one suit
  for (let suit = 0; suit < 4; suit++) {
    const napola = (1 << suit) | (1 << (suit + 4)) | (1 << (suit + 8));
    if ((m & napola) === napola) threes++;
  }
  return [threes, fours];
});

type Deal = [number, number, number, number];
const key = (d: readonly number[]) => d.join(",");

function possibleDeals(): Set<string> {
  const seen = new Set<string>();
  const masks = [0, 0, 0, 0];
  const deal = (card: number) => {
    if (card === CARDS) {
      if (masks.some((m) => bits(m) > 10)) return;
      const [p0, p1, p2, p3] = masks.map((m) => PLAYER_ZVANJA[m]);
      seen.add(key([p0[0] + p1[0], p0[1] + p1[1], p2[0] + p3[0], p2[1] + p3[1]]));
      return;
    }
    for (let p = 0; p < 4; p++) {
      masks[p] |= 1 << card;
      deal(card + 1);
      masks[p] &= ~(1 << card);
    }
  };
  deal(0);
  return seen;
}

const deals = Array.from(possibleDeals()).map((k) => k.split(",").map(Number) as Deal);
// a team may leave a zvanje unannounced: anything below a possible deal can be entered
const below = (d: Deal, top: readonly number[]) => d.every((n, i) => n <= top[i]);
const allowed = (d: Deal) => deals.some((top) => below(d, top));

test("ZVANJA_DEALS are exactly the largest deals the cards allow", () => {
  const largest = deals.filter((d) => !deals.some((o) => key(o) !== key(d) && below(d, o)));
  assert.deepEqual(new Set(ZVANJA_DEALS.map(key)), new Set(largest.map(key)));
  assert.equal(ZVANJA_DEALS.length, 22);
});

test("zvanjaError allows a hand's zvanja exactly when the cards can make them", () => {
  const z = (threes: number, fours: number): ZvanjaCounts => ({3: threes, 4: fours});
  let count = 0;
  for (let a3 = 0; a3 <= 8; a3++)
    for (let a4 = 0; a4 <= 4; a4++)
      for (let b3 = 0; b3 <= 8; b3++)
        for (let b4 = 0; b4 <= 4; b4++) {
          const ok = allowed([a3, a4, b3, b4]);
          if (ok) count++;
          assert.equal(zvanjaError(z(a3, a4), z(b3, b4)) === null, ok, `${a3} × 3 + ${a4} × 4 against ${b3} × 3 + ${b4} × 4`);
        }
  // 66 deals happen, and two more are below one (1 × 3 against 5 × 3, either way round)
  assert.equal(count, 68);
});

test("one team alone: 7 threes with no four, 5 with one, 2 with two, none with three", () => {
  const team = new Set(deals.map(([a3, a4]) => key([a3, a4])));
  assert.deepEqual(
    Array.from(team).sort(),
    [[0, 7], [1, 5], [2, 2], [3, 0]].flatMap(([fours, max]) => Array.from({length: max + 1}, (_, threes) => key([threes, fours]))).sort(),
  );
  assert.equal(zvanjaError({3: 7, 4: 0}, NO_ZVANJA), null);
  assert.equal(zvanjaError({3: 8, 4: 0}, NO_ZVANJA), "Ekipa ne može imati ta zvanja.");
});

test("the most a hand can carry: 21 for one team, and 21 for both together", () => {
  const points = ([a3, a4, b3, b4]: Deal) => [3 * a3 + 4 * a4, 3 * b3 + 4 * b4];
  assert.equal(Math.max(...deals.map((d) => points(d)[0])), 21);
  assert.equal(Math.max(...deals.map((d) => points(d)[0] + points(d)[1])), 21);
  // with a zvanje of 4 the team's most is 19
  assert.equal(Math.max(...deals.filter((d) => d[1] > 0).map((d) => points(d)[0])), 19);
});
