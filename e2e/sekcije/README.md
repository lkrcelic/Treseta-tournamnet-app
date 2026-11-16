# Section agents: shared rules

You write one section of the Treseta Playwright suite. Your section file (`e2e/sekcije/<id>.md`) says what to cover; this file says how. The plan behind it is `E2E_SUITE_PLAN.md`. Read both, plus the Playwright part of the `testovi` skill (`.claude/skills/testovi/SKILL.md`). Treseta's code is mostly Bela's; what is Treseta's own (the game, conferences, places) is listed in `BELA_SYNC.md`.

## Where you work

- **Your worktree:** `/Users/lovro/projects/github/Treseta-tournamnet-app/.claude/worktrees/e2e-<id>`, on branch `e2e/<id>`. Run every command from there. Other agents (Treseta's and Bela's) work in their own worktrees at the same time: never touch a path outside yours, and never run `git stash`, `checkout` or `reset` on anything but your own branch.
- **Your files:** `e2e/tests/<area>/<id>-*.spec.ts` (the area is in your section file) and `e2e/helpers/<id>.ts` for helpers only your section needs. Everything else is read-only for you: the shared helpers (`e2e/helpers/fixtures.ts`, `world.ts`, `db.ts`, `health.ts`, `scorepad.ts`), `e2e/playwright.config.ts`, `e2e/local/`, `e2e/seed/`, and all app code (`src/`, `prisma/`). The pilot section C1 is the one exception: its file says what it may change.
- **Your app:** one server and one database of your own, started from the shared production build:
  - `e2e/local/app.sh start <id>`: a fresh database `treseta_e2e_<id>` with the generated world, then `next start` on your port (about 15 s). Run it outside the sandbox (podman and localhost).
  - `e2e/local/app.sh stop <id>` when you are done, and before a fresh start.
  - `e2e/local/app.sh status <id>`: port, database, pid.
  The world is built around the real "now" and is the same for every section; its ids are in `e2e/local/run/<id>/seed-manifest.json`, which the `world` fixture reads. Every account's password is `sifra`.
- **Running tests:** `E2E_ID=<id> npx playwright test -c e2e <your spec files>` (outside the sandbox). Typecheck: `npx tsc -p e2e --noEmit`.

## How tests are written here

- Use the fixtures from `e2e/helpers/fixtures.ts`: `world` (the manifest's catalog), `as(role or username)` (a page in its own logged-in context, phone-sized by default, opened as from the home screen so the install sheet stays away), `db` (a Prisma client on your database, for setup, time shifts and asserts), `healthy(page)` (no console errors, no 5xx, no horizontal scroll).
- Find elements by role and Croatian label (`getByRole`, `getByLabel`, `getByText` for plain text). `data-testid` doesn't exist in the app and you can't add it. Every page has Next's empty route announcer with role `alert` (`#__next-route-announcer__`), so a bare `page.getByRole("alert")` breaks strict mode: scope it to a region or add `.filter({hasText: /\S/})`.
- Wait for outcomes with `expect(...)`; never `waitForTimeout`, never `force: true`.
- Assert the outcome a person cares about (the hand is in the list, the standing moved, the table closed), and check it in the database too when the screen alone could lie.
- Expected values come from intent, written before you run the app: the Treseta rules (`BELA_SYNC.md` · Game rules, `src/app/_lib/game/scoring.ts`), Bela's `DECISIONS.md` and `CHANGELOG.md` (`../Bela-Treseta-Tournamnet-app/`) for shared behaviour, the commit messages on `master` for Treseta's own changes, and your section file.
- **The Treseta game:** a hand is 11 points between the teams (the keypad types one team's points, the other gets the rest); Kaput is 11 : 0; zvanja are 3 and 4 per team on top of the hand; Custom types each team's points freely (no zvanja) and is where "s ovim dosta" is called; a match goes to 41, and teams level at or above it play on to 51, 61 …; a league table plays two matches; a bye is 5 : 0 per match, and so is a no-show. A tournament may play "na prolaz" (no call, no raise: level at the target plays one more hand, Custom is Kaput on the players' screens).
- Time never passes for real: move it in the database (`db.ts` helpers, or SQL on `published_at`, `ends_at`, …), then reload or call `/api/cron/tick` with `Authorization: Bearer e2e-cron`.
- **Repeatable:** every spec must pass `--repeat-each=5` in one run against your server without a new seed between repetitions. A test that changes the world either makes its own piece first (a league night, a table, an ad, through the app's API or Prisma in a fixture) or puts back what it changed.
- Phone first: player and admin flows run on the `mobitel` project (390×844, touch). A spec meant for the desktop too is named `*.racunalo.spec.ts`. Landscape is not supported: never test it.

## From the merged sections

C1 (the pilot) built the fixtures and `e2e/helpers/scorepad.ts`; C1–C5, K and L are merged, and their specs show them in use. Bela's suite has the same section ids: when a Bela section is committed (`git -C ../Bela-Treseta-Tournamnet-app show e2e/<id>:e2e/tests/…`), start from its specs and change what Treseta does differently, rather than writing them again.

- **Setup through the app:** `api(who)` is a logged-in request context with no page. Make your own piece through the app's routes with it, as the admin or a phone would (scorepad.ts: `publishTable` → `startMatch` → `addHands`). Afterwards remove your own Kolo with the admin's `DELETE /api/admin/leagues/<id>/rounds?date=…&round_number=…`; `removeNight` removes every Kolo of a night and is only for a league your section owns. The server recounts the standings and replays the ratings.
- **The scorepad helper** names teams, never left/right (the viewer's own team is on the left): `enterHand(page, {team, points, zvanja: {[team]: [3, 4]}})` and `enterCustom(page, {points: {[team]: n}, dosta})` on the players' board, `openHand`, `correctHand`, `finishMatch`, `handRow(page, n)`. The hand rows' accessible names ("Igra n: L prema R, ukupno …") are the steadiest assertions.
- **Shared seeded tables:** on `leagues.scorepad` and the current league, take a fresh table with `publishTable` rather than reuse a seeded one; a corrected seeded hand goes back with `savedHand`/`putHand`.
- **Clocks:** the seeded open matches have no Vrijeme partije, so nothing closes by time while you work. A test about the clock gives its match one with `freshClock(db, matchId, minutes)` and then moves `ends_at`. `/api/cron/tick` closes every due match in the database, other sections' too: call it only as `e2e/helpers/c4.ts` does, with every other due match's deadline set aside. Other states are relative to the seed's "now" (the arrival window, start times, Kolo publish times): for a state as seeded, `app.sh start` again or move its times in the database.
- **After midnight:** until 06:00 the league night is still yesterday's (`leagueNightString`), while Datumi counts the calendar day. On master Početna drops tonight's card after midnight (shared code; Bela's `1f7d51e` comes with the sync): `helpers/l.ts` has `afterMidnight()` for a `test.fail` on it. The nightly run starts before 06:00.
- **Players:** a player who isn't onboarded gets the birth-date or "Pušiš li?" sheet over Početna (never on the scorepad, Tko igra or /round/). Pick one with `ONBOARDED` (db.ts); every scenario team has one. Teams of "E2E · Novo kolo" include one with three active players, so Tko igra asks which two play.
- **Rate limit:** each `as()`/`api()` context has its own X-Forwarded-For, because the app counts /api requests per address and the window never empties while requests keep coming (Bela #4). Keep it that way: reuse contexts, never strip the header.
- **App quirks (seen in Bela, shared code):**
  - textContent drops the spaces between spans ("8 / 8ekipa igra večeras"): use `\s*` in text regexes.
  - Standings use a real minus "−". Dnevni poredak rows start with the team's initial (an avatar letter).
  - The admin's table opens on Tko igra every time.
  - The players' Početna "Dnevni poredak" tile points at the selected league, so go to `/league/<id>/…` directly.
  - A tap right after a save can land during a view transition: use locator actions (they wait), or `tap({trial: true})` before a raw touchscreen tap.

## When the app is wrong

Leave the app alone. Keep the test as it should be, mark it `test.fail()` with a comment `// BUG: <one line>`, and put the bug in your report (steps, expected, actual, the screenshot path). Say whether the code is shared with Bela (not listed in `BELA_SYNC.md`; the fix belongs in Bela) or Treseta's own. The lead checks it and opens the issue. A flake you can't explain is a finding too: report it, don't hide it behind a retry.

## Done

- Every flow in your section file has a test, or a line in your report saying why not.
- Every spec of yours passes `--repeat-each=5` (bugs marked `test.fail()` count as passing).
- `npx tsc -p e2e --noEmit` is clean.
- Committed on your branch `e2e/<id>` (the pre-commit hook runs `npm test`). No push. Your server stopped.

## Report (your final message)

```
Section <id>: <✅ done | ⏸ partly | ❌ blocked>
Branch e2e/<id> @ <short sha>; specs: <files>
Tests: <test name → flow it covers>, one per line
repeat-each=5: <passed n/n | which failed>
Bugs (test.fail): <title – steps – expected – actual – screenshot – shared or Treseta's own>, one per line, or "none"
Helper requests: <what the shared helpers should gain, and why>, or "none"
Scenario requests: <what the generator should add>, or "none"
FLOWS.md lines: <flow | test file › test name>, one per line
```
