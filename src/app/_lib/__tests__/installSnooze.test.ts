import assert from "node:assert/strict";
import {test} from "node:test";
import {installSnoozed, rememberInstallDismissed, snoozed, SNOOZE_DAYS} from "../installSnooze";

const NOW = Date.UTC(2026, 10, 8, 20, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

test("a sheet dismissed a moment ago, or earlier this week, stays away", () => {
  assert.equal(snoozed(String(NOW), NOW), true);
  assert.equal(snoozed(String(NOW - 3 * DAY), NOW), true);
  assert.equal(snoozed(String(NOW - (SNOOZE_DAYS * DAY - 1000)), NOW), true);
});

test("after the week it offers again", () => {
  assert.equal(snoozed(String(NOW - SNOOZE_DAYS * DAY), NOW), false);
  assert.equal(snoozed(String(NOW - 30 * DAY), NOW), false);
});

test("nothing stored, junk, or a dismissal in the future (a clock set back) offers the sheet", () => {
  assert.equal(snoozed(null, NOW), false);
  assert.equal(snoozed("", NOW), false);
  assert.equal(snoozed("juče", NOW), false);
  assert.equal(snoozed(String(NOW + DAY), NOW), false);
});

test("the dismissal is written and read back through localStorage", () => {
  const store = new Map<string, string>();
  const previous = (globalThis as {window?: unknown}).window;
  (globalThis as unknown as {window: unknown}).window = {
    localStorage: {getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v)},
  };
  try {
    assert.equal(installSnoozed(NOW), false);
    rememberInstallDismissed(NOW);
    assert.equal(installSnoozed(NOW + DAY), true);
    assert.equal(installSnoozed(NOW + SNOOZE_DAYS * DAY), false);
  } finally {
    (globalThis as unknown as {window: unknown}).window = previous;
  }
});

test("storage that throws (private mode) leaves the sheet offered and doesn't blow up", () => {
  const previous = (globalThis as {window?: unknown}).window;
  (globalThis as unknown as {window: unknown}).window = {
    localStorage: {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    },
  };
  try {
    assert.equal(installSnoozed(NOW), false);
    assert.doesNotThrow(() => rememberInstallDismissed(NOW));
  } finally {
    (globalThis as unknown as {window: unknown}).window = previous;
  }
});
