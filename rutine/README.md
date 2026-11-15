# Treseta routines

Treseta's code is mostly Bela's (`BELA_SYNC.md`), so Treseta has one routine of its own: `treseta-e2e-nightly`, which tests every night what Treseta runs and what the sync brought. Fixing and reviewing happen in Bela (its `rutine/README.md`), and the fixes come over with the sync. The morning report is Bela's, and it mentions Treseta only when something here doesn't work.

Treseta's local scheduled task only says "read `rutine/README.md` and `rutine/<id>.md` from Treseta's `master` and follow them", so these files are the routine: a change to it is a commit on `master`. Read this file first, then your own.

## The team

| Routine | Prompt | When (Zagreb) | Job | Hands off to |
| --- | --- | --- | --- | --- |
| `bela-nightly-sync` | Bela's `rutine/bela-nightly-sync.md` | 05:00 | deployed Bela commits → Treseta's branch `bela-sync` | `treseta-e2e-nightly` |
| `treseta-e2e-nightly` | `rutine/treseta-e2e-nightly.md` (here) | started by the sync; fallback 06:15 | unit, db, lint, tsc (and Playwright once the suite exists) on `master` and on `bela-sync` | its report, read by the morning report |
| `bela-jutarnji-izvjestaj` | Bela's `rutine/bela-jutarnji-izvjestaj.md` | 06:45 | one morning message; its Treseta line appears only when a test failed, a run stopped or didn't report, or `bela-sync` waits for the merge | — |

No fixer, release review, cloud scan or UX patrol for Treseta (decided 15 Nov 2026): a bug in shared code is fixed in Bela, Treseta's own code is fixed in interactive sessions, and the nightly run opens no issues.

## Places

- Treseta repo (the main folder): `/Users/lovro/projects/github/Treseta-tournamnet-app`, GitHub `lkrcelic/Treseta-tournamnet-app`. `master` is live production (Vercel builds it and runs its migrations); `bela-sync` holds the sync's commits until the user merges them.
- Bela repo: `/Users/lovro/projects/github/Bela-Treseta-Tournamnet-app`. Read only, except its gitignored `backups/.rutina.lock` and `reports/rutine/`.
- Memory: read `/Users/lovro/.claude/projects/-Users-lovro-projects-github-Treseta-tournamnet-app/memory/MEMORY.md` and follow it.
- Your scratchpad: the scratchpad directory of your session. Worktrees go there.

## Shared rules

- **The main folder is shared** with interactive sessions, which keep uncommitted work in it. Treat it as read-only: no edit, stash, checkout, switch, reset or commit there. The one writable place is the gitignored `reports/`. Code runs in your own worktree: `git worktree add --detach <scratchpad>/wt-<short sha> <sha>`, and `git worktree remove --force` it at the end.
- **Production is the user's.** Never commit to, merge into or push `master` or `bela-sync`. Never connect to Neon or production, never read `.env` or `backups/`, and never copy `.env` into a worktree: without it nothing can reach a real database.
- **Sandbox.** podman, anything on localhost (`npm run test:db:local`), `npm ci` and the two writes into the Bela repo's folder (the lock and your report) need the sandbox off.
- **Tests.** The `testovi` skill (`.claude/skills/testovi/SKILL.md`) says which test goes with a change; the `e2e-reviewer` agent checks the tests of a diff against it. `npm run test:db:local` runs the db tests on a fresh database in the podman Postgres `bela-e2e-pg`, shared with Bela.

## Lock

The routines of both repos share the laptop and podman, so they share Bela's lock, with Bela's rules:
- Take it: `mkdir <Bela repo>/backups/.rutina.lock` (atomic; it fails when someone holds it), then write `<routine id> <ISO time>` into `<Bela repo>/backups/.rutina.lock/owner`.
- Held, and the owner's time is under 3 hours old: skip your heavy steps and end ⏸ with "lock held by <owner>".
- Held for 3 hours or more: it is stale. Remove it, take it, and say so in your report.
- Release it (`rm -rf <Bela repo>/backups/.rutina.lock`) as soon as the heavy steps are done, and in your clean-up whatever happened.

## Report

Every run ends by writing `reports/rutine/<YYYY-MM-DD>/<routine id>.md` **in the Bela repo's folder** (the date of the run's start, Zagreb), because the morning report reads only Bela's reports. Contents: your final message, then at most 10 lines of detail (sha, what failed, where). A second run on the same day appends under a `## HH:MM` heading. A run without its report did not happen for the user.
