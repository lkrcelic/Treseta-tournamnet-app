---
name: testovi
description: Which test a change in this repo needs and how to write it (unit, db, Playwright). Use when changing logic or a user flow, fixing a bug, reviewing a commit's tests, or before committing.
---

# Tests in Treseta

Whoever writes the code writes its test, in the same commit. No routine writes tests afterwards: the author knows what the code should do, a later agent only sees what it does.

Most of the code is Bela's (`BELA_SYNC.md`). A change to shared code is made in Bela with its test, and both come over with the nightly sync. A Treseta-only change carries its test here, and a test of Treseta's own code is listed in `BELA_SYNC.md` like the code it tests.

## 1. Pick the test

| The commit changes | Test | Where |
| --- | --- | --- |
| Something a user does on a screen: entering or correcting a hand (Custom, Kaput, "s ovim dosta", zvanja 3 and 4), Tu smo, Tko igra, Završi meč, publishing a round, signing up for or leaving a tournament, Nedolazak, Vrati stol, Burza, logging in; a new flow; a new API route that changes data | Playwright | `e2e/tests/<area>/` |
| A service that writes to the database: transaction, lock (`FOR UPDATE`, advisory lock), two writes at once, CHECK or unique constraint, the fields a service hands to Prisma, an SQL procedure (`update_team_score`), rating replay, a migration that rewrites data | db | `src/app/_lib/__tests__/db/` |
| Pure logic: points, standings, dates and the 06:00 night rule, Treseta and tournament rules (11 a hand, 41 and the raised target, "s ovim dosta", "na prolaz"), what a screen shows from given data | unit | `src/app/_lib/__tests__/` |
| Text, spacing, colour, layout without a new button | none | the page crawl catches crashes |

- **Often two.** A flow change that also changes a rule carries a unit test for the rule and a Playwright test for the flow.
- **Logic inside a component** moves into a pure function in `src/app/_lib/` and is tested there (`ui/lineupPass.ts`, `smokingUi`, `ratingsUi`). There is no jsdom.
- **Until the Playwright suite exists** (`e2e/playwright.config.ts`), a flow change carries a unit or db test, and the commit message says "no E2E yet".

## 2. Bug fix: red first

The test reproduces the bug at the lowest level that can see it, and goes **red** on the code before the fix, then green with the fix. The commit message says it was red before.

Prove red in a throwaway worktree, because other sessions keep uncommitted work in the same folder and a stash or checkout there takes it with it:
```
git worktree add --detach "$TMPDIR/red" HEAD      # the code before your change (for a range: its first commit's parent)
ln -s "$PWD/node_modules" "$TMPDIR/red/node_modules"
cp <your new or changed test files> "$TMPDIR/red/<same paths>"
(cd "$TMPDIR/red" && npm test)                    # or the db / Playwright command for that test: must fail
git worktree remove --force "$TMPDIR/red"
```
- 5102b331: a tournament table of one match opened a second one → db test (`db/tournamentOneMatch.test.ts`).
- Bela #74: a second tap on Završi meč opened a finished match → Playwright, because the bug sat between the screen and the server.

## 3. Writing each kind

**Unit**: `node:test` and `assert/strict`, nothing else. A one-line comment on top says which behaviour the file guards. Test names state the rule, not the function: "a level score at the target plays one more hand", not "test matchState". Model: `src/app/_lib/__tests__/lineupPass.test.ts`.

**db**: model `src/app/_lib/__tests__/db/timeLimit.test.ts`.
- Each file creates its own league, teams and tables under a unique `tag` in `before` and deletes them in `after`. It never relies on rows it didn't create.
- Call the real service (`createResult`, `saveLineup`, `publishNight` …) and assert on what is in the database afterwards.
- For rules of play (a valid hand, a match to 41) use `_lib/game/scoring.ts` (`HAND_POINTS`, `MATCH_THRESHOLD`) and `__tests__/helpers/handEntry.ts` (`enterHand`) instead of hand-made numbers; once Treseta's generator exists, its `e2e/seed/play.ts` (`E2E_PLAN.md`).

**Playwright** (when the suite exists, `E2E_PLAN.md`):
- Find elements with `getByRole` / `getByLabel` by their Croatian label; `data-testid` only where a label repeats.
- Wait on the outcome (`expect(...).toBeVisible()`), never `waitForTimeout`; click without `force: true`.
- Assert the outcome: the hand is in the list, the standing changed, the table closed. A page that merely opened proves nothing.
- A test that changes data uses only its own scenario from `e2e/seed/out/seed-manifest.json`; a missing scenario goes into `e2e/seed/scenarios/` and `npm run seed:verify` stays green.
- Time moves in the database (shift `published_at`, `ends_at` with SQL), never by waiting real minutes.
- Phone 390×844 portrait for player flows. Landscape is not supported.
- `e2e/FLOWS.md` lists each flow with its test; add the line in the same commit.

## 4. Expectations come from intent

Write the expected values from the task, the Treseta rules (`BELA_SYNC.md`, Game rules and the other Differences), Bela's `DECISIONS.md` and `CHANGELOG.md` for shared behaviour, and the issue **before** running the app. When the app disagrees:
- the bug is part of this commit: fix it;
- it isn't: open an issue (in Bela's repo when the code is shared, since the fix belongs there) and commit the test marked with its number, `test.fail()` in Playwright or `test("…", {todo: "#N"}, …)` in node:test, so the suite stays green and whoever fixes it unmarks it with the fix;
- intent is unclear (the rules are silent): ask the user.

An intended behaviour change may change an existing `assert`/`expect` only in the same commit, and the message says why (`BELA_SYNC.md` entry, DECISIONS entry or issue).

## 5. Run before committing

- `npm test` (the `pre-commit` hook runs it too) and `npx tsc --noEmit`.
- `npm run test:db:local` when the commit touches anything from the db row of the table. One command, outside the sandbox (podman, localhost): it starts the podman Postgres `bela-e2e-pg` (127.0.0.1:55432, shared with Bela, creates it if missing), makes a fresh database, applies the migrations, runs `npm run test:db` and drops the database, also when a test fails. Plain `npm run test:db` only ever runs against a throwaway database, never Neon or production.
- A new Playwright test passes `--repeat-each=5`. A session runs only its own tests; the nightly run (`rutine/treseta-e2e-nightly.md`) runs the whole suite.
- Then the `e2e-reviewer` agent on the staged diff. Commit when it reports nothing.
