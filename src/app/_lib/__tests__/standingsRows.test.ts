import {test} from "node:test";
import assert from "node:assert/strict";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {MovementMark, StandingsRows} from "@/app/_ui/sp/Standings";
import type {StandingsRow} from "@/app/_lib/ui/standings";

// The phone's standings rows (Poredak mobitel B1): place, avatar, name, BOD over RAZ and, in Ukupni poredak, the +/−

function row(rank: number, movement: number | null): StandingsRow {
  return {
    key: String(rank),
    teamId: rank,
    rank,
    name: `Ekipa ${rank}`,
    played: 5,
    wins: 3,
    draws: 1,
    losses: 1,
    diff: "+612",
    points: 7,
    live: false,
    highlight: false,
    movement,
    photo: null,
  };
}

// The direct children of each element whose opening tag starts with `open` (e.g. "<li"): a tiny walk over the markup
// that only counts depth, enough for React's well-formed server output. The <style> tags Emotion writes before each
// styled element on the server are left out.
const VOID = new Set(["img", "br", "hr", "input", "meta", "link", "path"]);
function childCounts(html: string, open: string): number[] {
  const counts: number[] = [];
  const tags = html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "").match(/<\/?[a-zA-Z][^>]*?\/?>/g) ?? [];
  let depth = 0;
  let inside: {depth: number; index: number} | null = null;
  for (const tag of tags) {
    const closing = tag.startsWith("</");
    const name = tag.match(/^<\/?([a-zA-Z0-9]+)/)![1];
    const selfClosing = tag.endsWith("/>") || VOID.has(name);
    if (closing) {
      depth--;
      if (inside && depth === inside.depth) inside = null;
      continue;
    }
    if (inside && depth === inside.depth + 1) counts[inside.index]++;
    if (!inside && tag.startsWith(open)) {
      inside = {depth, index: counts.push(0) - 1};
    }
    if (!selfClosing) depth++;
    else if (inside && depth === inside.depth) inside = null;
  }
  return counts;
}

const rows = [row(4, 2), row(5, -1), row(6, 0), row(7, null)];

test("with showMovement each row has five cells, the last the stacked +/−, and the labels say +/-", () => {
  const html = renderToStaticMarkup(createElement(StandingsRows, {rows, head: true, showMovement: true}));
  assert.deepEqual(childCounts(html, "<li"), [5, 5, 5, 5]);
  assert.equal(html.match(/data-movement="stack"/g)?.length, 4);
  assert.match(html, />\+\/-</);
  assert.doesNotMatch(html, />Raz</);
});

test("without showMovement the rows have four cells and no +/-", () => {
  const html = renderToStaticMarkup(createElement(StandingsRows, {rows, head: true}));
  assert.deepEqual(childCounts(html, "<li"), [4, 4, 4, 4]);
  assert.doesNotMatch(html, /data-movement/);
  assert.doesNotMatch(html, /\+\/-/);
});

test("the stacked +/−: an arrow over the places, or a dash", () => {
  const mark = (movement: number | null) => renderToStaticMarkup(createElement(MovementMark, {movement, look: "stack"}));
  const up = mark(2);
  assert.match(up, /data-testid="ArrowDropUpIcon"/);
  assert.match(up, /<\/svg>2<\/span>$/);
  assert.match(up, /aria-label="Gore 2 od prošle večeri"/);
  const down = mark(-1);
  assert.match(down, /data-testid="ArrowDropDownIcon"/);
  assert.match(down, /<\/svg>1<\/span>$/);
  for (const still of [mark(0), mark(null)]) {
    assert.doesNotMatch(still, /<svg/);
    assert.match(still, />–<\/span>$/);
  }
});
