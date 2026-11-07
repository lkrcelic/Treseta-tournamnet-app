import assert from "node:assert/strict";
import {test} from "node:test";
import {lockKind, unlockEffects} from "@/app/_lib/tableLock";

// Otključaj partiju (DECISIONS #89): what counts as a locked table, and what the admin is told the unlock will do

const table = (over: Partial<Parameters<typeof lockKind>[0]> = {}) => ({open: true, attendance: null, matches: [], ongoing: 0, ...over});

test("a table is locked by its answer, by Vrijeme partije or by being played out", () => {
  // nothing locked: open, with or without a game running
  assert.equal(lockKind(table()), null);
  assert.equal(lockKind(table({ongoing: 1})), null);
  // Nedolazak and Preskočen are locked by the answer itself
  assert.equal(lockKind(table({open: false, attendance: "NO_SHOW"})), "no_show");
  assert.equal(lockKind(table({open: false, attendance: "SKIPPED"})), "skipped");
  // a table answered Da, tu su is just a table being played
  assert.equal(lockKind(table({attendance: "PRESENT"})), null);
  // closed by the clock, and played to the end
  assert.equal(lockKind(table({open: false, matches: [{time_expired: false}, {time_expired: true}]})), "time_expired");
  assert.equal(lockKind(table({open: false, matches: [{time_expired: false}]})), "done");
  assert.equal(lockKind(table({open: false})), "done");
});

test("the unlock says what it undoes, naming the team that didn't come", () => {
  const teams = {absent: "Purgeri", both: ["Purgeri", "Kvarnerci"] as [string, string]};
  const noShow = unlockEffects("no_show", teams);
  assert.equal(noShow.length, 3);
  assert.ok(noShow[0].includes("5 : 0"));
  assert.ok(noShow[1].startsWith("Purgeri se vraćaju u turnir"));
  // without a name the line still reads
  assert.ok(unlockEffects("no_show", {...teams, absent: null})[1].startsWith("Isključena ekipa"));
  // a skipped table brings both back
  const skipped = unlockEffects("skipped", teams);
  assert.ok(skipped[1].includes("Purgeri i Kvarnerci"));
  // a match that was played carries on, and its win comes off the table's score
  const expired = unlockEffects("time_expired", teams);
  assert.equal(expired.length, 2);
  assert.ok(expired[1].includes("skida"));
});
