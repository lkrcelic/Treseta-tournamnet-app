import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {DESKTOP_MIN_WIDTH} from "../../_styles/tokens";
import {DESKTOP_UP, fieldFont} from "../../_ui/sp/base";

// iOS Safari zooms the whole page in when an input, textarea or select under 16 px takes the focus, and pinch zoom
// stays available (DECISIONS 16), so the page stays zoomed after the keyboard is closed. Every phone field goes
// through fieldFont, which holds the floor.
test("a field is never under 16 px on the phone", () => {
  for (const design of [12, 13, 14, 15, 15.5]) {
    assert.equal(fieldFont(design).fontSize, 16, `design ${design} px`);
  }
});

test("the desktop keeps the design's own size", () => {
  assert.deepEqual(fieldFont(15), {fontSize: 16, [DESKTOP_UP]: {fontSize: 15}});
  // a field the design already draws at 16 px or more is the same size on both
  assert.deepEqual(fieldFont(17), {fontSize: 17, [DESKTOP_UP]: {fontSize: 17}});
});

test("the switch is the layout's own desktop breakpoint", () => {
  assert.equal(DESKTOP_UP, `@media (min-width: ${DESKTOP_MIN_WIDTH}px)`);
});

// The fields the admin uses through a league night: the paper search variant (Traži ekipu in Novo kolo and Skica
// kola, Dodaj ekipu in Upravljanje turnirom), SearchAddField (Dodaj ekipu / Dodaj igrača / Dodaj u ligu) and the
// Bilješke lige textarea. They were 15 px and zoomed the page in (issue #9), so they must keep using fieldFont.
test("the phone's own fields set their size through fieldFont", () => {
  const fields: [string, RegExp][] = [
    ["src/app/_ui/sp/Form.tsx", /paper: \{[^}]*\.\.\.fieldFont\(/],
    ["src/app/_ui/sp/Profile.tsx", /font: "inherit",\s*\.\.\.fieldFont\(/],
    ["src/app/_ui/round/LeagueNotes.tsx", /fontFamily: "inherit",\s*\.\.\.fieldFont\(/],
  ];
  for (const [file, pattern] of fields) {
    assert.match(readFileSync(resolve(__dirname, "../../../..", file), "utf8"), pattern, file);
  }
});
