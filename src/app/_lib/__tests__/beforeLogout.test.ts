import assert from "node:assert/strict";
import {test} from "node:test";
import {onBeforeLogout, runBeforeLogout} from "../../_utils/beforeLogout";

// Logging out first lets a save that is still waiting go out (the session is gone after it), but not for long.

test("logging out waits for the work registered before it, and not for work taken off", async () => {
  const done: string[] = [];
  const off = onBeforeLogout(async () => {
    await new Promise((r) => setTimeout(r, 20));
    done.push("save");
  });
  const offGone = onBeforeLogout(async () => void done.push("gone"));
  offGone();
  await runBeforeLogout();
  assert.deepEqual(done, ["save"]);
  off();
});

test("a failed save doesn't stop the logout, and a hanging one holds it only until the time runs out", async () => {
  const offFail = onBeforeLogout(() => Promise.reject(new Error("offline")));
  const offHang = onBeforeLogout(() => new Promise(() => {}));
  const start = Date.now();
  await runBeforeLogout(50);
  assert.ok(Date.now() - start < 1000);
  offFail();
  offHang();
});
