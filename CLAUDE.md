# Treseta Tournament app

## Bela is primary

- Most of the code is the Bela app's (`../Bela-Treseta-Tournamnet-app`). A feature or fix for both apps is built in Bela and reaches Treseta with the nightly sync onto the branch `bela-sync`.
- Change Treseta directly only for what has to differ, and list it under Differences in `BELA_SYNC.md` in the same commit.
- `master` is production: Vercel builds it and applies its migrations to the production database.

## Tests

- A commit that changes logic or a user flow carries its test (unit, db or Playwright), written by its author; a bug fix carries a test that is red without the fix. The `testovi` skill says which test and how.
- Before committing a behaviour change: `npm test`, `npx tsc --noEmit`, then the `e2e-reviewer` agent on the staged diff.
- The `pre-commit` hook in `.githooks/` runs `npm test`; enable it once per clone with `git config core.hooksPath .githooks`.

## Supported layouts

- Phone: portrait only. Landscape on the phone is not supported, so don't design or fix for it, and don't report landscape-only problems as bugs.
- Computer: supported.
