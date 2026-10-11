# Transition plan: Treseta app → Bela app design

Bring this app to the Bela app's design, features and backend fixes, and keep Treseta's game rules.

- **Source:** the Bela app (`../Bela-Treseta-Tournamnet-app`), `origin/master` = `development` = `4bf68ad` (8 Oct 2026).
  Its own records: `PLAN.md` (design and screens), `DECISIONS.md`, `BACKEND_REVIEW.md`, `REFINEMENTS.md`, `TEST_REPORT.md`.
- **Target:** this repo, branch `feat/scorepad`. Production is the Vercel project `treseta-tournamnet-app`, built from
  `master`; its build runs `prisma migrate deploy`, so merging applies the migrations to the production database.
- **Status (11 Oct 2026):** Phases 1–5 are done locally on `feat/scorepad` (not committed, not pushed). The decisions
  were taken with the recommended defaults; each one is marked under [Decisions](#decisions) and is easy to change.
  Still open: the staging database (Phase 0), testing the migrations on a copy of production, and the cutover
  (Phase 6). See [Verification so far](#verification-so-far).

## Approach

1. **Transplant, don't port screen by screen.** Copy the Bela code into this repo, then swap Bela's game layer for
   Treseta's. The Bela app has moved far ahead (249 commits, 272 source files against 161 here, every screen
   redesigned), and about 90% of it doesn't depend on the game. Porting it screen by screen would redo that work.
2. **Keep the shared files identical to Bela's.** Everything outside the game layer is copied unchanged, so later
   Bela fixes can be cherry-picked (Phase 7). For the same reason the database takes Bela's names wherever shared
   code reads them (`Match.player_pair1_score` instead of `team1_score`).
3. **Keep this repo's history and the production data.** Bela's migrations are not copied: they describe Bela's
   database. New migrations convert the Treseta database to the target schema in place.

Out of scope: merging the two apps into one codebase, new Treseta rules (for example akuže as structured data, like
Bela's zvanja), and a design of Treseta's own.

## Treseta rules that stay

| Rule | Today | After the transition |
|------|-------|----------------------|
| Hand | One team's points are typed; the other team gets 11 − x (at most 11) | Same, and checked on the server |
| Custom hand | The "Custom" key: both teams' points typed freely (akuže and the like) | Same; the hand also remembers it was custom (D3) |
| Match | Over once a team has ≥ 41 and the scores differ ("Završi meč") | Same: `matchWinner` with threshold 41 |
| Round | 2 matches; standings give 2 points for a win and 1 for a draw, with the point difference from the match scores | Same. The standings SQL is identical to Bela's apart from column names (checked with a diff) |
| Bye | The round counts 2:0, with two matches of 5:0 | Same (Bela uses 301:0) |
| Scoreboard | The viewer's team on the left, every hand listed with both teams' points | Same, in the new design |

Nothing else in this repo needs to be kept. Its later fixes (live daily view, bye checks, rate limit) exist in the
Bela app in reworked form. Pairing is different there (D5).

## What comes over from the Bela app

- **Design:** the Scorepad look on phone and desktop (tokens, the `_ui/sp` kit, desktop shell with drawer, page
  transitions, installable app). Every screen in Bela's `PLAN.md` table except the Bela hand wizard.
- **Security:** an auth check on every API route (`requireUser`, `requireAdmin`, `canPlayRound`). This closes the
  five unprotected routes this app has today (`matches/create`, `matches/finish`, `result/create`, `result/[id]` PUT,
  `rounds/[id]/finish`). Also Next.js 14.2.35 (middleware auth bypass, GHSA-f82v-jwr5-mffw; this app is on 14.2.13),
  constant-time cookie signatures, a login limit per IP and username, 30-day sliding sessions, Google login linked
  to the password account with the same email, and a one-time birth-date prompt.
- **Game flow:**
  - Start Game locks the round, so several phones end up in the same match.
  - Finishing a match is one locked transaction. A second phone gets "already finished" and follows to wherever the
    round is now.
  - The scoreboard refreshes every 15 s.
  - Creating rounds twice with the same teams returns the existing rounds.
  - A round's lineup (who plays) is picked on Start Game.
- **Admin:**
  - Manage League (details, notes, rounds, active teams) and Create League.
  - Manage Teams.
  - Daily editing: re-pair or remove tables, and a scorepad for the live and the finished matches, with standings and
    ratings recalculated.
- **New features:** player ratings (Glicko-2) with a ratings page and history, and pairing with blossom matching.
- **Tooling:** 119 unit tests (74 don't depend on the game and come over unchanged). `npm run dev` no longer wipes the
  database; `dev:reset` does.

## Where the two apps will differ

After the transplant, these files differ from Bela's. Everything else under `src/` is a copy. This is the list as
planned; the current one, kept up to date by the nightly sync, is the Differences section of
[BELA_SYNC.md](BELA_SYNC.md).

**The game layer** (Treseta's own versions):

| Bela | Treseta | What it holds |
|------|---------|---------------|
| `_lib/bela/scoring.ts` | `_lib/game/scoring.ts` | `HAND_POINTS = 11`, `MATCH_THRESHOLD = 41`, `BYE_MATCH_POINTS = 5`, `matchWinner`, `handError(p1, p2, custom)`. Pure, unit tested |
| `_lib/validation/validateResult.ts` | same path | `normalizeHand` checks a hand. `InvalidResultError` stays here, unchanged, since shared services import it |
| `_interfaces/belaResult.ts`, `belaPlayerAnnouncement.ts` | `_interfaces/result.ts`, `_interfaces/side.ts` | A hand is `team1_game_points`, `team2_game_points`, `custom`. `TeamSide` moves to `side.ts` |
| `_interfaces/match.ts`, `_interfaces/adminHand.ts` | same paths | The same export names (`AdminHandValidation`, `PadHand` with `id`, `total1`, `total2`, …), so the shared admin routes and the Daily table page stay as they are |
| `_lib/helpers/databaseHelpers.ts` | same path | Copies a finished match and its hands from `OngoingMatch`/`OngoingResult` to `Match`/`Result` |
| `_lib/service/ongoingBelaResult/*` | `_lib/service/ongoingResult/*` | Save and edit a hand with Bela's row locks; refuse a hand once the match is over |
| `_lib/service/ongoingMatch/getOneWithResults.ts`, `getRoundId.ts`, `match/finishOngoingMatch.ts`, `admin/hands.ts` | same paths | Bela's logic on Treseta's hand tables |
| `_store/bela/resultStore.ts`, `announcementStore.ts` | `_store/game/resultStore.ts` | Today's Treseta keypad (`_store/resultStore.ts`: 11-split, Custom), plus Bela's "the first digit after switching team starts a new number" |
| `_fetchers/ongoingBelaResult/*`, `api/ongoing-bela-result/*` | `_fetchers/ongoingResult/*`, `api/ongoing-result/*` | |
| `ongoing-match/[matchId]/ongoing-result/**` (3 steps) | one step: `…/new/score`, `…/[resultId]/score` | Team boxes ("Igra · team") and the keypad, with Custom where Bela has Štiglja. Saving goes back one entry (Bela goes back three) |
| `ongoing-match/ui/handFlow.ts`, `HandEntryPanel.tsx`, `ongoing-match/[matchId]/page.tsx` | same paths | The desktop panel without "Tko je zvao" and zvanja; hand rows from Treseta's hands |
| `_lib/ui/adminEntry.ts`, `daily-standings/table/AdminEntryPanel.tsx` | same paths | Two modes: normal (11-split) and Custom, which replaces Bela's "Ručni unos" |
| `_bootstrap/refreshUser.ts`, `_utils/resetStores.ts` | same paths | No announcement store |
| `prisma/schema.prisma`, `prisma/seed.ts` | same paths | Treseta's hand tables; a Treseta seed |
| `scoring`, `serverHand`, `handEntryStores`, `scoreboardMatch`, `adminEntry` tests and `helpers/handEntry.ts` | same names | Rewritten for Treseta's rules |

**Shared files with a small edit.** Each is one line or one constant; Phase 7 removes most of these differences.

| File | Edit |
|------|------|
| `_hooks/useStartGame.ts`, `round/lineup/[roundId]/page.tsx`, `daily-standings/table/[roundId]/page.tsx` | `1001` → `MATCH_THRESHOLD` |
| `_lib/service/round/insertPairRounds.ts` | Bye matches `301 : 0` → `BYE_MATCH_POINTS`, threshold → `MATCH_THRESHOLD` |
| `ongoing-match/ui/useMatchSides.ts` | Imports `TeamSide` from `_interfaces/side` |
| `_store/ongoingMatchStore.ts` | The hands field is `results` (Bela: `belaResults`) |
| `_lib/service/league/getStandings.ts` | Drops `tournament_id: null` (Treseta has no tournament tables; Bela doesn't use its own either) |
| `_lib/service/admin/recalc.ts` | `RATINGS_FROM` (D6) |
| Branding (Phase 4) | `layout.tsx`, `_ui/auth/AuthFrame.tsx`, `_ui/sp/DesktopShell.tsx`, `_ui/install/InstallSheet.tsx`, `_hooks/useLeagues.ts`, `public/manifest.webmanifest`, `public/icons/*`, the URL in `installPlatform.test.ts` |

**Not copied from Bela:** `prisma/migrations`, `prisma/seed*.ts`, `.env`, the Bela docs (link to them instead),
`backups/`, `bela-tournament-app.zip`, `tmp-file.ts`, `.idea/`, the trump-caller and zvanja steps with their store,
and the unused images in `public/` (`TitleBackground*.png`, `background.png`, `title.png`).

## Database

The target is Bela's schema with Treseta's hand tables, and without Bela's tournament tables (unused) and
announcement tables. The game models:

```prisma
model Match {
  id                 Int       @id @default(autoincrement())
  round_id           Int?
  player_pair1_score Int       @default(0)
  player_pair2_score Int       @default(0)
  score_threshold    Int?
  start_time         DateTime?
  end_time           DateTime?
  match_date         DateTime? @default(now()) @db.Date

  round   Round?   @relation(fields: [round_id], references: [id], onDelete: SetNull)
  results Result[]
}

// The match being played at a table (Bela's model); moved to Match when it is finished
model OngoingMatch {
  id                 Int       @id @default(autoincrement())
  round_id           Int?
  player_pair1_score Int       @default(0)
  player_pair2_score Int       @default(0)
  score_threshold    Int?
  start_time         DateTime? @default(dbgenerated("CURRENT_TIME")) @db.Time()
  end_time           DateTime? @db.Time()
  match_date         DateTime? @default(now()) @db.Date

  round   Round?          @relation(fields: [round_id], references: [id], onDelete: SetNull)
  results OngoingResult[]
}

// One hand: normally the two teams' points add up to 11; a custom hand is typed freely
model Result {
  result_id         Int     @id @default(autoincrement())
  match_id          Int
  team1_game_points Int     @default(0)
  team2_game_points Int     @default(0)
  custom            Boolean @default(false)

  match Match @relation(fields: [match_id], references: [id], onDelete: Cascade)
}

// OngoingResult: the same columns, belongs to OngoingMatch
```

Every other model is a copy of Bela's: `Player` with the rating fields and an optional `birth_date`, the `League`
admin fields, `LeagueTeam.active`, `Round` with `ongoingMatches` and `roundPlayers`, `RoundPlayer` and
`PlayerRatingHistory`.

**New migrations**, after `20251106121506`. Generate the DDL with `prisma migrate diff` (from the migrations to the
new schema), split it into these files and add the data steps by hand.

| # | Migration | Content |
|---|-----------|---------|
| 1 | `match_like_bela` | Rename `Match.team1_score`/`team2_score` → `player_pair1_score`/`player_pair2_score`; make `start_time` and `match_date` nullable as in Bela. Recreate `update_team_score` and `get_league_standings_by_date` from Bela's current SQL, word for word: they read the renamed columns, and PL/pgSQL only notices a renamed column when the function runs |
| 2 | `ongoing_match` | Add `Result.custom` and mark every existing hand whose points don't add up to 11 as custom. Create `OngoingMatch` and `OngoingResult`, move the matches being played (`active = true`) with their hands, then drop `Match.active` |
| 3 | `player_ratings` | Bela's `add_player_ratings` and `rating_history`, word for word |
| 4 | `league_admin` | Bela's `league_admin` and `league_end_date_notes`, word for word |
| 5 | `optional_birth_date` | Bela's, word for word. This app's Google sign-up stores the same placeholder birth date (`api/auth/[...nextauth]/route.ts:36`) |
| 6 | `round_lineup` | Bela's, word for word |

Bela's history for seating, dealers and player pairs (`remove_seating_order` and earlier) has no counterpart here,
since this app never had those tables.

The data step of migration 2 (normally it moves nothing, because the cutover happens between league nights):

```sql
INSERT INTO "OngoingMatch" (id, round_id, player_pair1_score, player_pair2_score, score_threshold, start_time, match_date)
SELECT id, round_id, player_pair1_score, player_pair2_score, score_threshold, start_time::time, match_date
FROM "Match" WHERE active;

INSERT INTO "OngoingResult" (result_id, match_id, team1_game_points, team2_game_points, custom)
SELECT r.result_id, r.match_id, r.team1_game_points, r.team2_game_points, r.custom
FROM "Result" r JOIN "Match" m ON m.id = r.match_id
WHERE m.active;

DELETE FROM "Match" WHERE active; -- their hands go with them (ON DELETE CASCADE)

SELECT setval(pg_get_serial_sequence('"OngoingMatch"', 'id'), COALESCE(MAX(id), 0) + 1, false) FROM "OngoingMatch";
SELECT setval(pg_get_serial_sequence('"OngoingResult"', 'result_id'), COALESCE(MAX(result_id), 0) + 1, false) FROM "OngoingResult";

ALTER TABLE "Match" DROP COLUMN "active";
```

**Checks.** Run these on a copy of production before and after the migrations; the results must match.

- `TeamScore` rows per league and team.
- `get_league_standings_by_date` for every league and round date.
- The number of matches and the sums of both teams' scores (`Match` before; `Match` plus `OngoingMatch` after).
- The number of hands (`Result` before; `Result` plus `OngoingResult` after). The number marked custom equals the
  number of hands whose points don't add up to 11.
- Before the cutover, also list rounds that have two finished matches but are still open (the old app finishes a
  round from the phone after leaving the page, so this can fail). Close them with the admin finish.

## Phases

### Phase 0: Preparation

- [x] Decide D1–D4; D5–D9 can follow. (D1–D8 decided; D9 is optional.)
- [x] ~~Hotfix `master` first (D8).~~ Decided: no hotfix, the security fixes ship with the transition.
- [x] Branch `feat/scorepad` from `master`.
- [ ] A staging database for previews: a Neon branch of production. Today `DATABASE_URL` is set for Production only,
      so preview builds fail at `prisma migrate deploy` (and can't touch production). Either turn on the Neon
      integration's database branch per preview deployment, or create one branch and set `DATABASE_URL` for
      Preview, limited to the git branch `feat/scorepad`. The database is a Neon project linked through Vercel; it
      isn't in the Neon account connected to Claude Code.
- [x] Locally: Postgres, plus a dump of production for testing the migrations (`backups/prod-2026-10-11.dump`,
      gitignored).
- [x] Save the check queries as `prisma/usefulQueries/transition_checks.sql`.

### Phase 1: Transplant

- [x] Export Bela at the recorded commit, so nothing uncommitted comes along:
      `mkdir -p "$TMPDIR/bela" && git -C ../Bela-Treseta-Tournamnet-app archive 4bf68ad src scripts public tsconfig.test.json package.json package-lock.json .gitignore | tar -x -C "$TMPDIR/bela"`.
- [x] Replace `src/` as a whole (no merge, so no old Treseta file survives by accident). Copy `scripts/`,
      `tsconfig.test.json`, `package.json` and the lock file (renamed `treseta-tournament-app`), `.gitignore`,
      `public/manifest.webmanifest` and `public/icons/` (Bela's until Phase 4).
- [x] Delete the Bela-only files: the trump-caller and announcement steps, `_store/bela/announcementStore.ts`.
- [x] Take `.env` out of git (`git rm --cached .env`, add it to `.gitignore`), and add `.env.example`.
- [x] Note in the README: "Shared code from the Bela app at `4bf68ad`".

The branch builds again once Phases 2 and 3 are done.

### Phase 2: Schema and migrations

- [x] `schema.prisma` as in [Database](#database).
- [x] Migrations 1–6, tested on the restored copy of production until the checks match. (Also on a fixture shaped
      like production. On the real data, 9 abandoned matches are deleted; see Verification.)
- [x] A Treseta seed like Bela's (users `admin` and `player`, a league with 8 teams, example.com emails), so
      `npm run dev:reset` works.

### Phase 3: Game layer

- [x] `_lib/game/scoring.ts` with its tests first.
- [x] Server: `validateResult`, the `ongoingResult` services, `finishOngoingMatch`, `databaseHelpers`, `admin/hands`,
      the `ongoing-result` routes. The server checks every hand:
      - a normal hand is two whole numbers ≥ 0 that add up to 11;
      - a custom hand follows D4;
      - no hand once the match is over.
- [x] Phone: "Upiši igru" opens the score step directly. It has the two team boxes, the keypad 1–9 / Custom / 0 / X,
      and Nazad / Spremi. With Custom off, the active team gets the typed points (at most 11) and the other team the
      rest; with Custom on, each team's box takes its own number. Editing a custom hand opens with Custom on.
- [x] Desktop: the entry panel with the team boxes, the keypad with Custom, and "Spremi igru". Digits type and Enter
      saves.
- [x] Admin scorepad (Daily): normal and Custom modes, editing hands of the live and the finished matches.
- [x] The small edits in shared files (table above).
- [x] A redirect from the old `/match/:id` to `/` for phones that still have it open.
- [x] Tests: the 74 copied tests pass unchanged; rewrite the 5 game test files.

### Phase 4: Branding

- [x] "Trešeta Liga" in place of "Bela Liga" and "Piatnik Bela Liga":
      - the page title and the Apple title in `layout.tsx`;
      - the manifest (`name`, `short_name`, `description`);
      - the wordmarks in `AuthFrame` and `DesktopShell`;
      - the three install-sheet texts (Croatian cases: "otvori Trešeta Ligu");
      - the fallback league name in `useLeagues` (its storage key `bela.chosenLeague` stays: it is per browser tab
        and per site, so it can't clash with the Bela app).
- [x] The line above the wordmark ("Piatnik" in Bela) per D7.
- [x] Icons: 192, 512 (also maskable) and the Apple touch icon, a "TL" in the BL icon's style.
- [x] Colors stay: this app already uses the same navy, cream, green and red.

### Phase 5: Verification

- [x] `npm test`, `npm run lint`, `next build`. `tsc --noEmit` shows no new errors in touched files (both apps
      build with `ignoreBuildErrors`, so the build doesn't catch them).
- [x] Locally with the seed data, at 375 × 812 and 1440 × 900:
      - [x] login, Home as player and as admin;
      - [x] Start Game → lineup → scoreboard;
      - [x] hands: normal, custom, editing a custom hand (stays custom), hands the server refuses;
      - [x] reaching 41 → Završi meč → match 2 → Kraj kola;
      - [x] Daily, league standings, ratings;
      - [x] Create Round, a night with a bye (5:0, 5:0), pairings;
      - [x] the admin scorepad: a finished match's hand made custom, the round flipped to 2:0, standings and ratings
            recalculated;
      - [x] the old `/match/:id` redirects home.
- [ ] Still to do on the preview with production data: the same pass, plus wrong password, signup, profile, Create
      Round with the same teams twice, Manage League, Manage Teams, and two browsers on one match.
- [x] The standings after the migration match the snapshot from before (on a copy of production), except the point
      difference on the 4 nights with an abandoned match, as intended.

### Phase 6: Cutover

On a day without league play, after everyone has finished:

1. Check that no match is being played and that no finished round is still open (the checks above).
2. Make a restore point: a Neon branch `pre-scorepad` of production.
3. Rotate `SECRET_KEY` for Production in Vercel. The committed `.env` holds a key. Rotating signs out password logins,
   which last only 4 hours today anyway.
4. Merge `feat/scorepad` into `master`. The Vercel build migrates the database and deploys.
5. Ratings: `npm run ratings:replay` against production as a dry run (tried on the copy: works, e.g. 1236–1727), then with `-- --apply`. Otherwise the first
   round that closes computes them.
6. On production, check: login with a password and with Google, Home, the standings against the snapshot, last
   night's Daily, ratings, installing on a phone.
7. Tell the players to reload the app, and to add it to the home screen again for the new icon.

**Rollback:** Vercel Instant Rollback to the previous production deployment, together with restoring the database
from `pre-scorepad`. Code and database go back together, because the old code reads `Match.team1_score`.
If the migration fails during the build, the old deployment stays live, but the database can be partly migrated:
restore from `pre-scorepad`, fix the migration, and retry.

### Phase 7: Keeping the two apps in sync

- [x] `git remote add bela ../Bela-Treseta-Tournamnet-app`. A Bela commit that touches only shared files then comes
      over with `git cherry-pick`. Record the Bela commit each sync reaches.
- [x] A nightly sync: the scheduled task `bela-nightly-sync` cherry-picks Bela's new commits onto the branch
      `bela-sync` at 04:00, keeps the differences, and records the Bela commit it reached. See
      [BELA_SYNC.md](BELA_SYNC.md). After the cutover it works on top of `master` once `feat/scorepad` is merged
      there (or the local branch is deleted).
- [ ] Optional, in the Bela repo (D9): the same neutral names as here (`_lib/game/scoring.ts` with the constants,
      `_interfaces/side.ts`, `_store/game/`), with `1001`, `301` and `RATINGS_FROM` taken from the game module. Then
      only the game layer and the branding differ between the two apps.

## Decisions

**D1. Where does a match being played live?** Recommended: Bela's model, `OngoingMatch`/`OngoingResult`, moved to
`Match`/`Result` when finished. This app dropped those tables on 31 Aug 2025 for simplicity, but Bela's Start Game
lock, finish transaction, admin scorepad, table editing, live Daily tables and open rounds are all built on them.
Keeping `Match.active` would mean rewriting about 20 shared files and keeping them different from Bela's.
*Taken: Bela's model (migration 2).*

**D2. Bela's column names on `Match`?** Recommended: yes (`player_pair1_score`, `player_pair2_score`). It costs one
rename, and the standings SQL has to be recreated in any case. Otherwise eight shared files and the SQL differ by a
name, and every cherry-pick touching them conflicts. *Taken: renamed (migration 1).*

**D3. Should a hand remember it was custom?** Recommended: yes, a `custom` column. Today a custom hand reopens in
normal mode, and the first digit typed turns it into an 11-split. Existing hands whose points don't add up to 11 are
marked custom. On the admin scorepad, Custom replaces Bela's "Ručni unos" (the same idea: only the points).
*Taken: `Result.custom` and `OngoingResult.custom` (migration 2).*

**D4. What may a custom hand contain?** Proposed: whole numbers ≥ 0 for both teams, at least one above 0, each at
most 99. Bela's manual hand allows up to 9999. Is there a real maximum for a hand with akuže? *Decided: the
proposal (`CUSTOM_HAND_MAX = 99` in `_lib/game/scoring.ts`).*

**D5. Pairing.** Bela pairs teams within score windows using blossom matching. A pair's cost is the square of their
earlier meetings, and the same pair never meets twice in one night (16 tests). This app's cost is earlier meetings
× 20 plus the score difference. Recommended: Bela's. The change is that the score difference no longer breaks ties
inside a window. *Taken: Bela's pairing, unchanged.*

**D6. Where do ratings start?** This app never had ratings, so any start date replays consistently. Recommended:
the whole Treseta history, so the ratings page means something on day one. The alternative is from the cutover,
with everyone at 1500. Either way, rounds without a lineup count for today's rosters (as in Bela). *Taken: the
whole history (`RATINGS_FROM` = 1 Aug 2025 in `_lib/service/admin/recalc.ts`).*

**D7. Branding.** The name "Trešeta Liga" (what the app shows today). What goes in the line above it (Bela: the
sponsor "Piatnik")? The icon "TL": make it in the Claude Design project "Piatnik Bela Liga app refresh", or another
way? There's no Treseta design project. *Decided: "Trešeta Liga" with no line above it (there's no sponsor), and a
"TL" icon drawn like the BL one (same font, colors and size). All of it is in `_lib/brand.ts` and `public/icons/`.*

**D8. Hotfix production first?** The five unprotected routes and Next.js 14.2.13 are live today. Recommended: if the
cutover is more than about two weeks away, ship a small fix to `master` first. That's `requireUser` on those routes
and Next 14.2.35. *Decided: no hotfix; the fixes ship with the transition. Checked on this branch: every mutating API route requires a
login (`requireUser` / `requireAdmin` / `canPlayRound`), only login, signup, logout and the Google callbacks are open,
and Next.js is 14.2.35.*

**D9. Neutral names in the Bela repo** (Phase 7)? Optional. It makes future syncs mostly plain cherry-picks.
*Not done: it changes the Bela repo.*

## Verification so far

On 11 Oct 2026, locally, with a throwaway Postgres 17:

- **Migrations:** applied on top of this app's 7 migrations, on data shaped like production (finished rounds, a bye,
  normal and custom hands, a match being played, a round left open, a Google sign-up). The checks in
  `prisma/usefulQueries/transition_checks.sql` match before and after: team scores, every night's standings, match
  totals and hand counts. The match being played moved with its id and hands, and new ids continue after it.
  `prisma migrate diff` shows no drift between the migrations and `schema.prisma`.
- **On a copy of production** (dump of 11 Oct 2026 in the gitignored `backups/`): the migrations apply cleanly. Team
  scores (51 rows), match totals (1365 matches, 44899 : 44512) and hands (8269, 387 custom) match. The 9 abandoned
  matches are deleted, so only the point difference changes, in 10 rows of the night standings on 22 Oct, 12 Nov and
  26 Nov 2025 and 14 Jan 2026, where the old function had counted them. Nothing ends up in `OngoingMatch`.
- **Code:**
  - `npm test`: 108 pass (74 copied from Bela, 34 new for the Treseta rules).
  - `next lint`: clean.
  - `next build`: succeeds.
  - `tsc --noEmit`: 2 errors, both already in the same shared files in the Bela app (Bela has 5).
  - 215 of the 266 source files are identical to the Bela app's.
- **Browser:** the pass listed under Phase 5, with no server errors.

## Risks

- **The migration breaks the old app the moment it runs** (renamed columns). The Vercel build migrates and deploys
  together, and the cutover happens when nobody plays.
- **Phones with the old app open** call endpoints that no longer exist. The app has no offline mode, so a reload
  fixes it; the `/match/:id` redirect helps.
- **A failed migration in the production build** can leave the database partly migrated. Restore from the restore
  point before retrying.
- **Bela's open items come along:**
  - Google login wasn't tested end to end, and Google accounts are linked by an email that is never verified
    (`BACKEND_REVIEW.md`, "Worth knowing").
  - `next-auth` is a beta with open advisories.
  - Some type errors already exist in the code, and builds ignore type errors.
- **The two apps drift apart again.** Phase 7.

## Rough effort

| Phase | Size |
|-------|------|
| 0 Preparation | half a day |
| 1 Transplant | half a day to a day |
| 2 Schema and migrations | 1–2 days, most of it testing on the copy of production |
| 3 Game layer | 2–3 days |
| 4 Branding | half a day, plus the icon |
| 5 Verification | 1 day |
| 6 Cutover | half a day |
