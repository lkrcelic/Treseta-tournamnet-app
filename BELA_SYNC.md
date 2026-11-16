# Syncing with the Bela app

The Bela app (`../Bela-Treseta-Tournamnet-app`) is primary: design, features and fixes are built there once and come
here every night. Only the differences listed under [Differences from Bela](#differences-from-bela) stay Treseta's
own; everything else is kept identical to Bela.

## Sync state

| | |
|---|---|
| Bela branch | `development`, read through the remote `bela` (the local Bela repo). Only commits come over, never Bela's uncommitted work |
| Last synced Bela commit | `b3443b9` (12 Nov 2026) |
| Target branch | `master` |
| Sync branch | `bela-sync` in the repo itself (no worktree): created from `master`, or rebased onto it, by every run |

The nightly sync moves the last synced commit forward. The other rows are built into the scheduled task: change the
task along with them.

## How the nightly sync works

Every morning at about 05:00 (cron `0 5 * * *`, plus a few minutes of jitter) the Claude desktop app runs the
scheduled task **Bela → Treseta sync** (`bela-nightly-sync`; its prompt is
`~/.claude/scheduled-tasks/bela-nightly-sync/SKILL.md`). It runs while the app is open; a run missed because the app
was closed or the Mac was asleep starts when it is back. To run it now: Scheduled → Bela → Treseta sync → Run now.

The run works in the repo folder itself, not in a worktree, so the task must start there (the sandbox lets a run
write only inside the folder it started in). The run of 13 Oct used a worktree and nothing came over. The
task's permission mode shouldn't wait for approvals, since nobody is there to give them; both are its settings in the
app's Scheduled screen. A run that finds uncommitted changes in the repo stops without touching them.

1. Switches to `bela-sync`: creates it from `master`, or, when it exists, rebases it onto `master`, so an earlier
   run's unmerged commits stay and the sync continues after them. A rebase conflict stops the run.
2. Takes each new commit on Bela's `development`, oldest first, with `git cherry-pick -x`. Only Bela's changes count,
   not its shas: when Bela's history is rewritten, the last synced commit is found again by its tree (or its subject
   and date), as on 16 Oct 2026, when `e39abc1` became `b9afd0e`. A change to a shared file
   comes over as it is; a change to one of the differences below is handled as its kind says, and the commits under
   [Bela's work waiting to come over](#belas-work-waiting-to-come-over) as that section decides.
3. Stops at the first commit it can't bring over with confidence, keeps the ones before it, and says why.
4. Checks the result: unit tests, ESLint, `tsc` (no new errors), `next build`, and the migration SQL against the schema.
5. Records the Bela commit it reached (above, and in the [log](#sync-log)), and reports every file that differs from
   Bela without being listed below (drift).
6. Last, a must whenever `bela-sync` is ahead of `master`: on a fresh local database (`bela_sync_check` on the local
   Postgres at `localhost:5433`) it applies every migration, checks for drift against the schema, runs the seed,
   starts the built app on port 3100 (`bela-sync-check` in `.claude/launch.json`) and clicks through it as `admin` and
   `player`, then drops the database. A failure there, or a local Postgres that isn't running, heads the report.
7. Switches back to the branch the repo was on, leaving `bela-sync` for you to merge.

It never commits to `master`, never pushes, never changes the Bela repo, and connects to no database but its own
throwaway `bela_sync_check`.

**In the morning,** read the run's report in the app, then on `master`:

```bash
git log --oneline master..bela-sync
git merge --ff-only bela-sync
```

Look at `bela-sync` with `git log` / `git diff`. If you don't merge it, the next run rebases it onto `master` and
carries on from where it stopped.

**A night that brings a migration** tests it on a fresh local database, not on production's data. Before it reaches `master`
(the Vercel build applies migrations to production), test it as the transition did: apply all migrations to a fresh
local database and check for drift, then apply them to a restored copy of production and compare
`prisma/usefulQueries/transition_checks.sql` before and after.

```bash
export DATABASE_URL=postgresql://postgres@localhost:5433/bela_sync_check
export DATABASE_URL_UNPOOLED=$DATABASE_URL   # migrations connect through this one; without it .env's database is used
echo 'CREATE DATABASE bela_sync_check' | npx prisma db execute --url postgresql://postgres@localhost:5433/postgres --stdin
npx prisma migrate deploy
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
echo 'DROP DATABASE bela_sync_check' | npx prisma db execute --url postgresql://postgres@localhost:5433/postgres --stdin
```

**Bela is primary.** A fix or a feature for both apps goes into Bela and reaches Treseta the next morning. Change
Treseta directly only for what has to differ, and add it below.

## Bela's work waiting to come over

Every Bela commit up to `b3443b9` (12 Nov 2026) came over or was skipped by 13 Nov 2026, including the range
`88425c3..d2a0b98` whose tournament files had been copied by hand on 10 Nov: a commit whose files were already here
was skipped, and one that was partly here came with only the part the copy missed. Decisions for Bela work that touches
Treseta's differences before it comes over go here.

**Bela's test and routine flow was brought over by hand on 15 Nov 2026**, from Bela's `development` at `1ac528b`,
before Bela deployed it (see [ORKESTRACIJA_AGENATA.md](ORKESTRACIJA_AGENATA.md)). What the sync does with those
commits when Bela's `master` reaches them:
- `16198f5` (tests with every commit): `.githooks/pre-commit` and `scripts/test-db-local.sh` are here word for word,
  so they apply to the same end state or come up empty; the hook is already enabled in this checkout. The skill
  `testovi`, the agent `e2e-reviewer` and `CLAUDE.md` conflict or differ: keep Treseta's (Repository files, Small
  edit) and carry in only what Bela changed in them after `1ac528b`. `package.json`'s `test:db:local` is here.
  `ORKESTRACIJA_AGENATA.md`, `E2E_PLAN.md` and `UNIT_PLAN.md` are Treseta's own versions.
- `2f3d6e6`, `02a2b26`, `5dfd2bc`, `fb3b3d2`, `1ac528b` (Bela's routines and plans): not copied; Treseta's
  `rutine/` and plans are its own.
- `9642282` (the E2E data generator): `e2e/seed/**` and `package.json`'s `seed:e2e` and `seed:verify` are not
  copied until Treseta has its own generator ([E2E_PLAN.md](E2E_PLAN.md)); its `.gitignore` line comes over.
- `c9b8d6b` (Bela's old documents to `docs/arhiva/`): not copied, Treseta archived its own the same day; its comment
  change in `_lib/googleAuth.ts` comes over.

**Uživo, Nadolazeći and Završeni came by hand on 14 Nov 2026** as Treseta's `8eb3b56` (Bela's `10f5167`), first
without `entries_hidden` (`7378fda`), which came back with Sakrij broj prijava (Bela's `97c6bed`) when bela-sync was
rebased on 17 Nov. Bela's `433c54c` (a tournament being played on the top card for everyone) came with only its day-card
line, since Uživo shows it to everyone. What the sync does with `10f5167` and `0d48380` (the top card as in Treseta):
they apply to the same end state or come up empty; where they conflict, take Bela's side for `mainTournament` moving
to `_lib/tournaments.ts`, which picks the same tournament as Treseta's `TournamentsOverview.tsx` does now.

## Differences from Bela

Each difference is one of four kinds, and the nightly sync treats a Bela change to it by its kind:

- **Own version:** Treseta's file replaces Bela's. Bela's change isn't merged as it is: what it means for Treseta (a
  design, a fix, a new field) is carried into Treseta's version, and what belongs to Bela's game (zvanja, štiglja,
  the trump caller, 1001 points) is left out.
- **Small edit:** Bela's file with a small Treseta edit, usually a line or a constant. Bela's change is merged around
  the edit.
- **Not copied:** Bela files that never come here. A Bela change to them is dropped, or carried into the Treseta
  counterpart when there is one.
- **Treseta only:** files Bela doesn't have. They stay as they are.

Paths are under `src/app/` unless marked "(root)".

### Game rules (own version)

A hand is 11 points, or a custom hand typed freely; a match goes to 41; a round is two matches; a bye round is 5:0 twice.
A match ends by the rulebook's section 10: teams level at or above the target play on to a target 10 higher (41 → 51 →
61), and a team that calls "s ovim dosta" (entered as a custom hand, then asked on the scorepad) wins once it reaches
the target with that hand, even with fewer points. The hands carry the call (`dosta_side`) and a finished match its
winner (`Match.winner_side`); everything else is worked out by replaying the hands (`matchState`).

A tournament may instead play its matches "na prolaz" (Kraj partije, `MatchEnd`: `Tournament.match_end`, copied to
`Round.match_end` like Zvanja and Igra se do; a league is always `S_OVIM_DOSTA`): no "s ovim dosta" and no raise of the
target. Once a team is at the target the team with more points wins; level at or above it, one more hand is played,
and each such tie gives Vrijeme partije 5 more minutes (`MatchState.extensions`). The players' Custom key is Kaput
there, only a shortcut for 11 : 0 to the picked team (a normal hand, zvanja as usual; the server refuses a player's
custom hand at such a table). The admin's screens keep Ručni unos (Custom) for corrections and have no Kaput, and no
"s ovim dosta" question follows a custom hand. A level score shows the "Izjednačeno · još jedna igra" flag
(`LevelFlag`, `levelAtTarget`).

| Treseta | Bela counterpart | What it holds |
|---|---|---|
| `_lib/game/scoring.ts` (Treseta only) | `_lib/bela/scoring.ts` | `HAND_POINTS = 11`, `CUSTOM_HAND_MAX = 99`, `MATCH_THRESHOLD = 41`, `TARGET_RAISE = 10`, `BYE_MATCH_POINTS = 5`, `handError`, `matchWinner`, `matchState` (the hands replayed by the table's `MatchEnd`: target, winner, "s ovim dosta", `extensions`, `levelAtTarget`), `dostaCallers`, `ratedMatch`, `MATCH_ENDS`, `DEFAULT_MATCH_END`. Zvanja: `ZVANJA_VALUES = [3, 4]`, `handTotals`, `zvanjaError` and `canAddZvanje` against `ZVANJA_DEALS` (what the cards allow, derived again by `zvanjaDeals.test.ts`). Pure, unit tested |
| `_lib/validation/validateResult.ts` | same path | `normalizeHand` checks a hand and its zvanja (`sentZvanja`, `newHandZvanja`, `assertZvanja`; Bela has `declarationsError` for its own zvanja); `InvalidResultError` stays Bela's, since shared services import it |
| `_interfaces/result.ts`, `_interfaces/side.ts` (Treseta only) | `_interfaces/belaResult.ts`, `_interfaces/belaPlayerAnnouncement.ts` | A hand is `team1_game_points`, `team2_game_points`, `custom`; `TeamSide` |
| `_interfaces/match.ts`, `_interfaces/adminHand.ts` | same paths | Bela's export names (`AdminHandValidation`, `PadHand`, …) on Treseta's hands, so shared code reads them unchanged |
| `_lib/helpers/databaseHelpers.ts` | same path | Copies a finished match and its hands from `OngoingMatch`/`OngoingResult` to `Match`/`Result` |
| `_lib/service/admin/hands.ts`' `noWinnerWarning` | same path | Meč ostaje bez pobjednika? (a warning the admin confirms, `NoWinnerWarning`): compares the match's `winner_side` with the hands replayed (`matchState`), where Bela compares the stored points with the threshold or Vrijeme partije (`finishedMatchWinner`, not here) |
| `_lib/service/ongoingResult/*` (Treseta only) | `_lib/service/ongoingBelaResult/*` | Saves and edits a hand with Bela's row locks; holds a phone's hand back when another phone saved one meanwhile (`expected_hands`, `HandsChangedWarning`, a 409 the Igra step asks about: "Je li ovo nova igra?"); refuses a hand once the match is over, a "s ovim dosta" call that can't stand, and a player's custom hand at a table "na prolaz" (`matchState.ts`: `ongoingMatchState` reads the table's `match_end`, `assertPlayersHand`; `update.ts` takes `admin`) |
| `_lib/service/ongoingMatch/getOneWithResults.ts`, `_lib/service/ongoingMatch/getRoundId.ts`, `_lib/service/match/finishOngoingMatch.ts`, `_lib/service/admin/hands.ts` | same paths | Bela's logic on Treseta's hand tables |
| `_store/game/resultStore.ts` (Treseta only) | `_store/bela/resultStore.ts`, `_store/bela/announcementStore.ts` | The keypad: the 11-split and Custom (Kaput at a table "na prolaz": `setKaput`), and each team's zvanja (3 and 4, `addZvanje`, `clearZvanja`) where Bela has its announcement store; persisted with `version: 1` |
| `_fetchers/ongoingResult/*`, `api/ongoing-result/*` (Treseta only) | `_fetchers/ongoingBelaResult/*`, `api/ongoing-bela-result/*` | Fetchers and routes for a hand |
| `ongoing-match/[matchId]/ongoing-result/layout.tsx`, `…/ui/WizardHeader.tsx`, `…/ui/pages/ScorePage.tsx`, `…/ui/pages/ZvanjaPage.tsx` (Bela's `AnnouncementPage.tsx`) | same paths, plus the trump-caller step | Hand entry in two steps, Zvanja (3 and 4) and Igra (the keypad with Custom where Bela has Štiglja, Kaput at a table "na prolaz"; the header is Bela's `TeamValueBoxes`, whose Treseta `zvanja` prop ends each box in a `ZvanjaStrip`, "Zvanja +7 · Σ 14" or "Bez zvanja · Σ 4", in the room of Bela's "Σ" line; `ZvanjaStrip` lives in `ongoing-match/ui/WizardParts.tsx`, and the admin's phone and both desktop panels show it too); a table "bez zvanja" and a custom hand skip Zvanja. Dalje and Natrag replace the step instead of pushing it, so the scoreboard stays one history entry behind. Spremi refused because the match was closed meanwhile (Vrijeme partije ran out, or a teammate finished it) says "Meč je već završen, pa ova igra nije spremljena." with Na meč to the board, as Bela's step 3 does since `a0686e1` and `e721909` (Treseta #2, 16 Nov 2026: `e721909`'s part of ScorePage is already carried in). A hand saved meanwhile from another phone asks "Je li ovo nova igra?" first (`ConfirmSheet`, Upiši i ovu); a refusal from that sheet still ends in Na meč. The `new/…` and `[resultId]/…` pages are shared |
| `ongoing-match/ui/handFlow.ts`, `ongoing-match/ui/HandEntryPanel.tsx`, `ongoing-match/[matchId]/page.tsx` | same paths | `handFlow.ts` has Bela's `matchClosed`, and `saveRefusal` and `MATCH_CLOSED_TEXT` (Bela keeps the text in its ScorePage) for the Igra step's refused Spremi. The desktop entry panel (with a row of 3, 4 and Obriši zvanja) and the hand rows (each hand's total), without "Tko je zvao" (so the team cards don't pass `ScorePanel`'s `onPick`, which picks Bela's caller); `startNewHand(matchId, hands)` and `saveHand`'s `force` for the hand saved from two phones; after a custom hand the scoreboard asks "Je li netko zvao „s ovim dosta”?", and a raised target shows as the "Do 51" flag. At a table "na prolaz" (`roundData.match_end`): Kaput on the Custom key, no question, and the `LevelFlag` on a level score at the target |
| `ongoing-match/ui/MatchEnd.tsx` (Treseta only) | none | The "s ovim dosta" question (a bottom sheet), the "Do 51" flag and "na prolaz"'s "Izjednačeno · još jedna igra" (`LevelFlag`), used by the scoreboard and the admin scorepad |
| `_lib/ui/adminEntry.ts`, `league/[leagueId]/daily-standings/table/AdminEntryPanel.tsx` | same paths | The admin scorepad: Normal and Custom, where Bela has "Ručni unos"; Custom's hint names "s ovim dosta" ("za ispravak" at a table "na prolaz": the panel's `naProlaz`; no Kaput for the admin). `levelAtTarget` for the "na prolaz" flag; `dostaAskHand`, the hand the "s ovim dosta" question is about (by its place in the match, `handPlace`, see Turniri · A corrected match goes back in play); `phoneBoardAction`, the phone board's Upiši igru or Završi meč. Zvanja as Bela's shape (`addZvanje`, `clearZvanja`) with 3 and 4 and Treseta's check, and the row hidden at a table "bez zvanja". `manualFields` (the phone's Custom sheet) takes 0 to `CUSTOM_HAND_MAX` (Bela: 0 to 9999). `adminEntry.ts` also holds `roundBackBy` (Natrag na kolo after a reload), which Bela keeps in the not copied `_lib/ui/tableScope.ts` |
| `_ui/admin/TablePhone.tsx` | same path | The admin's phone scorepad on Bela's board and sheets: Bela's korak 2 (zvanja: 3 and 4) and korak 3 (the keypad, the 11-split) without its korak 1 (the trump caller, opened as 2); a table "bez zvanja" opens on 3 (Bela's redirect from a Korak 2 or 3 without a hand isn't here); Natrag na kolo reads `roundBackBy` from `adminEntry.ts`; Custom (0 to 99, a custom hand) where Bela has Ručno and Ručni unos; after a custom hand the "s ovim dosta" question (`DostaPrompt`, through `runSheet`'s `after`, before Bela's `anyway` and `allow`; the hand by its place, `dostaAskHand`), and the "Do 51" flag on the board, or `LevelFlag` (`levelAtTarget`); `dostaCallers` gets the pad's `matchEnd` (no question "na prolaz"); Upiši igru and Custom on a finished match too, as on the computer, since "Meč ostaje bez pobjednika?" tells the admin to add the hands that were played (`phoneBoardAction`; decided 16 Nov 2026, Bela's phone has them only on the match being played and Otključaj partiju instead) |
| `_bootstrap/refreshUser.ts`, `_utils/resetStores.ts` | same paths | No announcement store |
| `_lib/__tests__/`: `scoring`, `serverHand`, `handEntryStores`, `scoreboardMatch`, `adminEntry`, `tableOverview`, `roundClose`, `finishedMatchEdit`, `tableLock` tests, `db/roundClose`, `db/finishedMatchEdit`, `db/tournamentNaProlaz`, `db/unlock`, `db/doubleHand`, `db/byeWinner` and `refusedHand` (Treseta only), `helpers/handEntry.ts` | same names | Tests of Treseta's rules (`tableOverview`: Treseta's hands, 41 and Custom's 0–99; the `db/` tests play custom hands to 41 and a bye worth `2 × BYE_MATCH_POINTS`; `byeWinner`: a league night's and a Kolo's bye give each match to the real team as its `winner_side`, and the migration `20261115140000_bye_winner_side` gives it to the byes written before; `roundClose` has no tournament table of one match; `tableLock` and `db/unlock` a Nedolazak of `NO_SHOW_SCORE` and a resumed match with a zvanje and a custom hand; `db/doubleHand` Treseta's hands through `createResult`) |

### Shared files with a small edit

| File | Treseta's edit |
|---|---|
| `_hooks/useStartGame.ts`, `round/lineup/[roundId]/page.tsx`, `league/[leagueId]/daily-standings/table/TablePreview.tsx` | `1001` → `MATCH_THRESHOLD` |
| `league/[leagueId]/daily-standings/table/[roundId]/page.tsx` | `1001` → `MATCH_THRESHOLD` (the comment says "Custom" for "Ručni unos"); after a custom hand `save` passes `run` an `after` (before Bela's `anyway` and `allow`) that opens the "s ovim dosta" question (`DostaPrompt`, `askDosta` with the hand's place for `dostaAskHand`, and `pickDosta`); the "Do 51" flag (`TargetFlag`), or "na prolaz"'s `LevelFlag`, next to the admin pill; a match tab adds "· do 51"; `dostaCallers` gets `pad.matchEnd`, and `AdminEntryPanel` its `naProlaz` |
| `_lib/service/admin/recalc.ts`, `_lib/service/ratings/ratings.ts` | The ratings read each match's `winner_side` through `ratedMatch`, so a "s ovim dosta" win with fewer points is a win (Bela compares the points). `recalc.ts` also has `RATINGS_FROM`, below |
| `_lib/service/round/insertPairRounds.ts` | Bye matches `BYE_MATCH_POINTS : 0` (Bela: `301 : 0`), threshold `MATCH_THRESHOLD`, and the real team as each match's `winner_side` (`createByeMatches`; Bela has no `winner_side`), as a no-show's matches have it |
| `ongoing-match/ui/useMatchSides.ts` | Imports `TeamSide` from `_interfaces/side` |
| `_interfaces/round.ts`, `_interfaces/adminHand.ts` | A table's `match_end` (`RoundExtendedResponseValidation`) and the pad's `matchEnd` ("na prolaz", see Game rules) |
| `_store/ongoingMatchStore.ts` | The hands field is `results` (Bela: `belaResults`) |
| `_lib/service/admin/recalc.ts` | `RATINGS_FROM` = 1 Aug 2025, so the whole Treseta history is rated (Bela: 7 Oct 2025) |
| `_lib/rating/glicko2.ts` | One comment: "for teams of two" (Bela: "for Bela teams of two") |
| `ongoing-match/ui/BoardParts.tsx` | `ScorePanel`'s `onPick` button presses to `tint.navy[4]` (Bela: a raw `rgba(14,27,51,.05)`, which the tokens test refuses); back to Bela's once Bela uses a token |
| `public/static/kalkulator-turnira-bc05b74508.html` (root) | Kalkulator turnirskih formata: its two texts say a Kolo is one match "do 41" (Bela: "do 1001") |
| `next.config.mjs` (root) | Redirects the old `/match/:id` to `/` |
| `package.json`, `package-lock.json` (root) | The name `treseta-tournament-app`, and `build` runs `node scripts/previewAdmin.js` after the migrations; without Bela's `seed:e2e` and `seed:verify` (Not copied). On a lock file conflict, take Bela's lock file and put the two names back |
| `.gitignore` (root) | Also ignores `.env` and `/backups/` |
| `.claude/skills/testovi/SKILL.md` (root) | Treseta's tests: a paragraph on shared code (tested in Bela) and Treseta's own (tested here, listed in this file); Treseta's hand entry and rules (Custom, Kaput, "s ovim dosta", zvanja 3 and 4; 11, 41, "na prolaz"); examples `5102b331` and Bela's #74 (Bela: `1bb39ea`, #74); db model `db/timeLimit.test.ts` and `createResult` (Bela: `doubleHand`, `createBelaResult`); rules of play from `_lib/game/scoring.ts` and `helpers/handEntry.ts` until Treseta has a generator; expectations from this file and Bela's DECISIONS; an issue for shared code goes to Bela, and no routine labels; the nightly run is `treseta-e2e-nightly` |
| `.claude/agents/e2e-reviewer.md` (root) | The range example `master..bela-sync`, the nightly run instead of the release review, intent from this file, and a step 5: Treseta's own code has its test here, and shared code changed here directly is a finding |

### Branding

| File | Treseta's |
|---|---|
| `_lib/brand.ts` (Treseta only) | "Trešeta Liga" and its accusative, no line above the name (Bela: "Piatnik"), the app icon's path (`icon`) and the transparent logo's (`logo`; Bela: the bell, `public/bell.webp`) |
| `layout.tsx`, `global-error.tsx`, `_ui/auth/AuthFrame.tsx`, `_ui/sp/DesktopShell.tsx`, `_ui/sp/PageMessage.tsx`, `_ui/profiles/PageParts.tsx`, `_ui/install/InstallSheet.tsx`, `_ui/home/PhoneHome.tsx` (three comments, and the header's brand: next to the rating chip the name takes two lines, smaller under 400 px), `_hooks/useLeagues.ts`, `league/[leagueId]/standings/page.tsx` (two comments) | Bela's "Bela Liga", "Piatnik Bela Liga", "Piatnik" and "BL" read from `BRAND` (the Brand block shows no eyebrow while `BRAND.eyebrow` is empty); the install sheet's titles and texts read `BRAND.name` and `BRAND.nameAccusative`. The install sheet's `AppIcon` draws `BRAND.icon` on cream where Bela draws `/icons/icon-192.png` (its bell). `AuthFrame.tsx`'s `Brand` puts `BRAND.logo` before the name (login, sign-up, Početna) where Bela puts the bell: on login the name is set in two lines and the logo is as tall as both. Početna's comments say logo where Bela's say bell |
| `public/manifest.webmanifest` (root) | `name`, `short_name`, `description`, and the maskable icon `icon-maskable-512.png` |
| `public/icons/*`, `public/logo.png`, `src/app/favicon.ico`, `src/app/icon.png` (root) | Treseta's flower logo (blue and yellow petals in a black ring), not Bela's "BL": `icon-192.png` and `icon-512.png` on a transparent background, `icon-maskable-512.png` and `apple-touch-icon.png` on the cream `#F5F2EA`; `logo.png`, `favicon.ico` and `icon.png` (the browser tab's, which Next links with a version) transparent. A Bela change to its icons is dropped, and Bela's bell (`public/bell.webp`) is not copied |

New Bela text with the app's name or the sponsor uses `BRAND` here, and its file joins this table. Example league
names in Bela's tests and comments stay as they are, and `_lib/navStack.ts`'s storage key `bela.navStack` stays Bela's:
the apps have separate origins.

### Conferences

A league can split its teams into conferences, each with a name and a color. The color is a dot before the team's
name, and Daily's night table and League standings get a view per conference. Create Round can pair every conference
on its own ("Only within conferences"). Bela doesn't have conferences for now. The plan and decisions are in
[docs/arhiva/CONFERENCES_PLAN.md](docs/arhiva/CONFERENCES_PLAN.md).

Conferences are a core part of Treseta and stay as they are. A Bela change is merged around them and never changes
what they do, how they look or what they say; when it can't be (Bela reworks a screen or a flow they live in, and it
isn't clear where they go), the sync stops at that commit. In Create Round, conferences decide the pairing, and Bela's
seating (smoking tables) runs after it and only places the pairs at tables.

New files (Treseta only):

| Treseta | What it holds |
|---|---|
| `_lib/conferences.ts` | The palette (re-exported from `_styles/conferences.ts`), the rules for a league's list (none or 2–6, names and colors unique), the lookup the screens use, tonight's teams by conference for Create Round, and "Distribute evenly". Pure, unit tested in `_lib/__tests__/conferences.test.ts` |
| `_lib/service/league/conferences.ts`, `api/leagues/[id]/conferences/route.ts`, `api/leagues/[id]/conferences/teams/route.ts`, `_fetchers/league/conferences.ts` | Reading a league's conferences (public) and saving them and the teams' conferences (admin) |
| `_styles/conferences.ts` | The six conference colors, kept in `_styles/` with the design tokens (the tokens test skips it) |
| `_hooks/useConferences.ts`, `_hooks/useConferenceFilter.ts` | A league's conferences for the screens, and the conference picked on Daily and League standings |
| `_ui/sp/TeamDot.tsx` | The dot before a team's name, taken from the Start Game card |
| `_ui/league/ConferenceEditor.tsx`, `_ui/league/ConferenceFilter.tsx`, `league/[leagueId]/manage/ConferencesCard.tsx`, `league/[leagueId]/manage/ConferenceParts.tsx` | The editor, the filter chips, and Manage League's conference cards and team picker |

Shared files with Treseta's conference code. A Bela change to one of them is merged around that code, as for a small
edit:

| File | Treseta's edit |
|---|---|
| `_interfaces/league.ts`, `_lib/service/league/leagues.ts`, `_fetchers/league/leagues.ts`, `_hooks/useLeagueTeams.ts`, `api/leagues/[id]/teams/[teamId]/route.ts`, `_ui/admin/LeaguePhone.tsx` | Create League takes conferences; a league's team list has each team's `conference_id`, and the team PATCH sets it (a team added on the phone's league screen starts with `conferenceId: null`) |
| `_interfaces/round.ts`, `api/rounds/generate-multiple/route.ts`, `_fetchers/round/createMultipleRounds.ts`, `_ui/round/CreateRound.tsx` | Create Round (desktop): the "Samo unutar konferencija" switch (`withinConferences`, under Rounds and Window, next to the smoking tables; the fetcher sends it after `smokingTables`) and the team list's dots. The switch is local state, off for every league, outside Bela's saved Novo kolo draft; `useCreateRound` also returns `hasConferences`, `withinConferences` and `setWithinConferences` for the phone. The route gives the teams their average age, pairs (by conference when asked), checks repeats, then Bela's `seatRounds` only places the pairs at tables |
| `_ui/admin/CreateRoundPhone.tsx`, `_ui/admin/DraftPhone.tsx` | The admin's phone: Novo kolo has the "Samo unutar konferencija" switch under the window, and Skica kola the teams' dots (its rows from `draftTableRows` with the league's conferences; `DraftTableList` draws each name with `TeamLabel`, whose `nameSx` gives Bela's two lines) |
| `_lib/matching/multipleRoundMatching.ts` | `generateGroupedRoundPairings` at the end of the file, which pairs every conference on its own with the unchanged pairing; a conference with too few teams throws `InvalidResultError` (a 400) |
| `api/rounds/open/route.ts`, `_fetchers/round/getOpenByPlayerId.ts`, `_hooks/useOpenTable.ts`, `_ui/home/StartCard.tsx` | The Start Game card shows the two teams' conference colors (green and red in a league without conferences) |
| `_lib/ui/standings.ts`, `_lib/ui/tables.ts`, `_ui/sp/Standings.tsx`, `_ui/sp/Controls.tsx`, `_ui/sp/index.ts`, `_lib/__tests__/conferences.test.ts` | Standings and table rows carry each team's conference (`conferenceOf` is a field of `toStandingsRows`' options; `toTableRows` has it as a third parameter, `draftTableRows` as a second), the standings draw its dot before the linked name (after the team's avatar, on the podium cards, the phone rows and the desktop table), a tab item can have a dot, and the kit exports `TeamDot` |
| `league/[leagueId]/daily-standings/page.tsx`, `league/[leagueId]/daily-standings/ui/RoundTables.tsx`, `league/[leagueId]/daily-standings/ui/RoundEditing.tsx`, `league/[leagueId]/standings/page.tsx`, `_ui/home/DesktopHome.tsx`, `league/[leagueId]/manage/DraftView.tsx` | The dots (also on Skica's tables, which replaced the pairings page, in and out of Uredi stolove; at a published round's tables the phone puts the avatar before the dot and name, and the desktop row puts the avatars next to the score with the dots just outside them), and the conference filter on Daily's night table and League standings. Ukupni poredak's +/− shows on the whole league's table only, not in a conference's view. Uredi stolove's pickers (on Dnevni poredak and in Skica: the desktop's pair dialog and the phone's pair sheet) take the league's `conferenceOf` and put each team's dot before its name, in the lists and the picked fields (the bye has none); `DesktopRound` on Dnevni poredak passes it on |
| `league/new/page.tsx`, `league/[leagueId]/manage/page.tsx`, `league/[leagueId]/manage/LeagueDetailsView.tsx` | Nova liga's Conferences switch and editor before Okupljanje (and their count in its summary); Upravljanje ligom's team picker, filter and Distribute card (Podaci shows the conferences card as its `aside`, under Okupljanje in the right column) |

The database part (the `Conference` table and `LeagueTeam.conference_id`) is under Database.

### Database

| Path (root) | Kind | Treseta's |
|---|---|---|
| `prisma/schema.prisma` | Own version | Bela's schema with Treseta's hand tables (`Result`, `OngoingResult`: `team1_game_points`, `team2_game_points`, `custom`, `dosta_side`, and each team's zvanja `team1_zvanja3`, `team1_zvanja4`, `team2_zvanja3`, `team2_zvanja4`) and `Match.winner_side`, without Bela's announcement tables and without `TeamScore.tournament_id` (see Turniri). `Tournament.declarations` and `Round.declarations` are Bela's; `Tournament.match_end`, `Round.match_end` and the `MatchEnd` enum (migration `20261111160000_match_end`) are Treseta's, with `score_threshold`. Bela's changes to the other models are merged in. The datasource also has `directUrl = env("DATABASE_URL_UNPOOLED")`, so migrations use Neon's direct connection (Bela has only `url`). Treseta also has the `Conference` table and `LeagueTeam.conference_id` (see Conferences), and Lokacije (see Lokacije): the `Location` table, `location_id` on `League`, `LeagueNight` and `Tournament` where Bela has `location_name`, `location_address` and `location_url`, `LeagueNight.second_location_id`, `LeagueNightTeam`, `Round.location_slot`, and `slot` in `CreateRoundDraft`'s key |
| `prisma/migrations/**` | Treseta only | This database's history. Bela's migrations are never copied: a Bela schema change gets a Treseta migration with Bela's SQL adapted to this schema, named with a timestamp after the newest migration here. Bela's names can collide with Treseta's: Bela's `20261011120000_league_nights_burza` has the timestamp of Treseta's `20261011120000_match_like_bela`, so it came as `20261011233000_league_nights_burza`, and Bela's `20261014120000_round_status` has the timestamp of Treseta's `20261014120000_s_ovim_dosta`, so it came as `20261014130000_round_status`, and Bela's `20261111120000_hide_entries` has the timestamp of Treseta's `20261111120000_zvanja`, so it came as `20261117120000_hide_entries` and Bela's `20261112120000_night_rounds` as `20261117120100_night_rounds`, after Lokacije's `20261115120000_locations_drop_text` |
| `prisma/seed.ts` | Own version | The Treseta seed (users `admin` and `player`, a league of 8 teams in two conferences, playing 16 Thursday nights from five weeks before the last Thursday at Caffe bar Kartaš; Lanterna in Lokacije, and the next night at both places with Sjever at Kartaš, three of Jug at Lanterna and Lavovi not placed). Seed data for new Bela tables is added here, with a place as `location_id` |
| `prisma/usefulQueries/**` | Own version | Treseta's queries, with `transition_checks.sql`. Bela's aren't copied |

### Repository files

| Path (root) | Kind |
|---|---|
| `README.md`, `.windsurfrules` | Own version |
| `CLAUDE.md` | Own version: Bela is primary, then Bela's Tests and Supported layouts sections word for word (a Bela change to those two comes over) |
| `ORKESTRACIJA_AGENATA.md`, `UNIT_PLAN.md`, `E2E_PLAN.md` | Own version: Treseta's plans, built on Bela's. A Bela change to its plans is carried in only when it changes how Treseta tests (the skill, the hook, the suite, the generator) |
| `.claude/skills/testovi/SKILL.md`, `.claude/agents/e2e-reviewer.md` | Small edit (below) |
| `rutine/` | Treseta only: `README.md` and `treseta-e2e-nightly.md`, the prompt of Treseta's nightly test run. Bela's `rutine/` is Not copied, so a Bela change to its `rutine/README.md` is dropped here |
| `docs/arhiva/` | Treseta only: `TRANSITION_PLAN.md`, `CONFERENCES_PLAN.md`, `TOURNAMENTS_PLAN.md`, `ZVANJA_PLAN.md`, `ProcessFlow.md` and `Task.md`, moved there on 15 Nov 2026 as Bela did with its own; Bela's `docs/arhiva/` is Not copied |
| `BELA_SYNC.md`, `LOCATIONS_PLAN.md`, `.env.example` | Treseta only |
| `scripts/previewAdmin.js` | Treseta only: on a Vercel preview, makes `lkrcelic` (password `sifra`) an admin on the preview's Neon branch, and fails the build if that database is production |
| `public/card.png` | Treseta only, left from the old app and unused |

### Not copied from Bela

- `public/bell.webp`, Bela's bell (see Branding).
- `.env` (Bela tracks it; here it is ignored), `next-env.d.ts` (ignored here), `.idea/`, `bela-tournament-app.zip`,
  `tmp-file.ts`, `skills-lock.json`, `backups/`, and `.claude/` except the skill `testovi` and `.claude/agents/`.
- Bela's documents: `PLAN.md`, `DECISIONS.md`, `BACKEND_REVIEW.md`, `REFINEMENTS.md`, `TEST_REPORT.md`, `BLOCKERS.md`,
  `RATING_INTEGRATION.md`, `docs/arhiva/**`, `rutine/**` (Bela's routine prompts), any other Markdown file Bela
  adds at its root, and its `reports/` folder. `CLAUDE.md`, `ORKESTRACIJA_AGENATA.md`, `E2E_PLAN.md` and `UNIT_PLAN.md` have Treseta's own
  versions (Repository files).
- Bela's E2E data generator, `e2e/seed/**`, and `package.json`'s `seed:e2e` and `seed:verify`: it plays Bela's game,
  so it doesn't even compile here. Not copied until Treseta has its own ([E2E_PLAN.md](E2E_PLAN.md)).
- Bela's database files: `prisma/migrations/**` (see Database), `prisma/seedHelpers.ts`, `prisma/usefulQueries/**`.
- Bela's game: `_lib/bela/`, `_interfaces/belaResult.ts`, `_interfaces/belaPlayerAnnouncement.ts`, `_store/bela/`,
  `_fetchers/ongoingBelaResult/`, `_lib/service/ongoingBelaResult/`, `api/ongoing-bela-result/`, and the hand entry's
  trump-caller and announcement steps (`ongoing-match/[matchId]/ongoing-result/new/` and `…/[resultId]/`:
  `trump-caller/`, `announcement/`; `…/ui/pages/TrumpCallerPage.tsx`, `…/ui/pages/AnnouncementPage.tsx`). Their
  Treseta counterparts are under Game rules.
- **Gost i poziv** (`3b85bfa`, DECISIONS #75, and its follow-ups `8e91edf`, `578330e`, `78caddb`), not copied for now
  (decided 7 Nov 2026): Treseta's league stays public without an account (Liga, Raspored, Dnevni and Ukupni poredak,
  Rejting and their APIs), Početna has no guest version, and there is no `GuestHome.tsx`, `GuestSheet.tsx`,
  `_store/guestSheetStore.ts` or "Sjedni za stol." sheet. A later Bela change to them is dropped; a change to a shared
  file that only follows from them is left out too: `requireUser` on `api/leagues/route.ts`,
  `api/leagues/[id]/standings/route.ts` and `api/leagues/[id]/daily-standings/route.ts`; Početna's guest branch
  (`page.tsx`); the guest's return path `?next=` (`authHref` in `_lib/publicPaths.ts`, `login/page.tsx`, and
  `signup/page.tsx`, whose Registracija s Googleom came over going back to `/login` and Google to `/`); `seasonGlance`
  in `_lib/nights.ts` and its test in `_lib/__tests__/nightTimes.test.ts`; `shadow.playingCard` in
  `_styles/tokens.ts`; and Burza's "Prijavi se da vidiš broj" (`burza/[id]/page.tsx`), which goes to `/login` where
  Bela opens the guest sheet.
- Unused images: `public/TitleBackground.png`, `public/TitleBackgroundSponsors.png`, `public/background.png`,
  `public/title.png`.

### Turniri

Treseta has Bela's one-day tournaments since 10 Nov 2026, which reverses the decision of 26 Oct 2026. The whole of
them came over — the Kolos and their pairing, the sign-ups and the waiting list, Potvrda dolaska, Nedolazak za stol,
the day's clock, the standings, the sign-up bans, the organizer role and Vrijeme partije — so `turniri/**`,
`api/tournaments/**`, `api/admin/tournaments/**`, `_ui/tournaments/**`, `_lib/tournaments.ts`, `_lib/tournamentDay.ts`,
`_lib/service/tournament/**`, `_lib/bans.ts`, `_lib/auth/**` and the rest are shared files now: a Bela change to them
comes over as usual, and the sync no longer stops at a tournament commit. Nothing runs on a timer in either app
(Bela's DECISIONS #69 and #70): whatever the day owes happens when someone reads the tournament (`syncTournament`),
and `/api/cron/tick`, the backup for the minutes nobody has the app open, is switched off in both — without
`CRON_SECRET` every request gets 401, and no scheduler calls it.

What stays Treseta's in them is the game, not the tournament:

| What | Treseta | Bela |
|---|---|---|
| A match | to 41 with "s ovim dosta" (`MATCH_THRESHOLD`), a tournament to 41 or 51 (Igra se do: `Tournament.score_threshold` and `Round.score_threshold`, which `createOngoingMatch` puts on the match, whatever the phone sends), and the form's grey note on how long a match takes (`gameLengthNote`); and Kraj partije, "s ovim dosta" or "na prolaz" (`match_end`, see Game rules); Pravila igre reads `41 · zvanja · s ovim dosta`, `51 · …`, `· bez zvanja` or `· na prolaz` | to 1001, with or without zvanja |
| Zvanja | 3 and 4, a click a zvanje, per team per hand (`Result`/`OngoingResult` counts); Bela's switch, form field and labels, where "bez zvanja" means none at all | 20 to 200 in announcement tables; "bez zvanja" still lets bela (20) through |
| Nedolazak za stol | the answering team wins every match as a Slobodna runda is won: `NO_SHOW_SCORE = [BYE_MATCH_POINTS, 0]` (5 : 0) at threshold 41, written with `Match.winner_side` | 1001 : 700 |
| Vrijeme partije | 45 minutes by default (`GAME_MINUTES_DEFAULT`), and five minutes more for every raise of the target, or "na prolaz" every level score at it (`TARGET_RAISE_MINUTES`, `MatchState.extensions`, `syncDeadline` in `_lib/service/match/timeLimit.ts`), which Bela has no rule for | 35 minutes, no raises |
| `TeamScore` | league only: no `tournament_id` and no either-or CHECK, since a tournament's standings are counted from its tables | the column and the CHECK |
| A team's chip in a tournament | Treseta's `TeamLabel` with no conference (a tournament has none) | `TeamChipBadge` |
| Prijavi se without an account | goes to Prijava; the tournament's pages are public, as the league's season table is | "Sjedni za stol." (Gost i poziv) |
| `_ui/sp/brand.ts` | `BRAND` from `_lib/brand.ts` (see Branding) | "Belatronika" |

Those rules live in these files, each Bela's with a small Treseta edit, so a Bela change to one is merged around the
edit:

| File | Treseta's edit |
|---|---|
| `_lib/tournamentDay.ts`, `_lib/service/tournament/attendance.ts`, `_bootstrap/TournamentAttention.tsx`, `_ui/tournaments/DayParts.tsx`, `_lib/tableLock.ts` | Nedolazak za stol: `NO_SHOW_SCORE = [BYE_MATCH_POINTS, 0]`, every match of the table written at `MATCH_THRESHOLD` with `winner_side`, and the texts reading the score (Bela: `1001 : 700`; `unlockEffects` too) |
| `_lib/service/admin/unlock.ts` | Otključaj partiju on Treseta's hands: a resumed match takes its `Result` rows (points, zvanja, custom, `dosta_side`) as `OngoingResult` rows, a Nedolazak's written matches are the ones without hands, and the table's wins are counted from `winner_side` (Bela: `belaResults` and `finishedMatchWinner`) |
| `_lib/gameTime.ts`, `_lib/service/match/timeLimit.ts` | Vrijeme partije: `GAME_MINUTES_DEFAULT = 45` and `TARGET_RAISE_MINUTES = 5` for every raise of the target or "na prolaz" level score (`MatchState.extensions`, `matchDeadline`, `syncDeadline`), which Bela has no rule for; `gameMinutesOf` reads the Kolo's minutes, then its tournament's, then its league's |
| `_interfaces/tournament.ts`, `_ui/tournaments/TournamentForm.tsx`, `_ui/tournaments/TournamentParts.tsx`, `_ui/tournaments/PlayerParts.tsx`, `_lib/tournaments.ts` | Zvanja as Bela's (`declarations`, the Zvanja choice, the "bez zvanja" chip and labels), but `rulesLabel(declarations)` reads `41 · zvanja · s ovim dosta` (Bela: `1001 · zvanja`), and `declarations` in the request defaults to true. The form's Vrijeme partije starts at `GAME_MINUTES_DEFAULT` (Bela: 35) |
| `_lib/service/tournament/kola.ts`, `_lib/service/tournament/tournaments.ts`, `_lib/service/tournament/views.ts`, `_lib/service/tournament/attendance.ts`, `_lib/service/admin/tables.ts`, `_lib/service/ongoingMatch/create.ts`, `_lib/service/round/finish.ts` (`lockRound`), `_lib/service/round/insertPairRounds.ts` (`createByeMatches`), `ongoing-match/ui/MatchEnd.tsx` (`TargetFlag`'s `base`), and the five files above | Igra se do and Kraj partije, Treseta's own: `score_threshold` (41 or 51) on the tournament, copied to a Kolo's tables like `declarations`, put on a match by `createOngoingMatch` from the table, and on a bye's and a no-show's matches; `match_end` the same way (tournament → Kolo's tables, `tables.ts` for a new table, drafts on a change), but read from the table; the form's Igra se do and Kraj partije choices and their grey notes (`gameLengthNote`, `matchEndNote`), "· do 51" and "· na prolaz" in the lists, `rulesLabel(declarations, threshold, matchEnd)` |
| `_ui/tournaments/PlayerParts.tsx`, `_ui/tournaments/SignUpSheet.tsx` | Prijavi se without an account goes to `/login` (Bela: the "Sjedni za stol." sheet, `useGuestSheet`), and the invitation links the tournament's page and names `BRAND` (Bela: Registracija's link, "Belatronika") |
| `_ui/tournaments/admin/KolaDesktop.tsx` | Novo kolo's team rows carry `conferenceId: null`: a tournament has no conferences |
| `_lib/service/tournament/attendance.ts` (`restoreTable`), `_lib/service/tournament/kola.ts` (`dropTables` exported), `api/admin/tournaments/[id]/tables/[tableId]/restore/`, `_fetchers/tournament.ts` (`restoreTableAPI`), `_ui/tournaments/admin/DayAdmin.tsx` (`TableStates`' Vrati stol and its `onChanged`, passed by `KolaDesktop.tsx` and `ManageTournamentPhone.tsx`), `_lib/__tests__/db/attendance.test.ts` | **Vrati stol**, Treseta's own since 13 Nov 2026 (a production fix, not in Bela yet): the admin or the tournament's organizer brings a skipped or no-show table back in play (open, attendance `PRESENT` by the admin, the no-show's matches gone), its excluded teams back and their Kolo 1 ban lifted, and an unpublished draft dropped. Worth building in Bela too; once Bela has it, take Bela's |
| `_lib/tournaments.ts` (`koloTimes`), `_lib/gameTime.ts` (`elapsedLabel`, `durationLabel`), `_lib/service/tournament/load.ts` (`closed_at`), `_lib/service/tournament/views.ts` (`KoloView.started_at`, `ended_at`), `_interfaces/tournament.ts` (`KoloView`), `_ui/tournaments/admin/KoloTimer.tsx`, `_ui/tournaments/admin/KolaDesktop.tsx`, `_ui/tournaments/admin/ManageTournamentPhone.tsx`, `_lib/__tests__/tournaments.test.ts`, `_lib/__tests__/gameTime.test.ts` | **Vrijeme kola**, Treseta's own since 13 Nov 2026 (not in Bela yet): the admin's timer of a Kolo, from its publishing to its last table's close (the latest match end or no-show/skip). On the computer the side card Kolo N traje has the big timer (od 20:14) and Kolo je trajalo 52 min (20:14 – 21:06) once it is played, and the Kolo over the whole screen a timer chip; on the phone the navy card has it beside the tables' bar, the Kolo's screen a chip, the list of Kolos the time after the tables. Worth building in Bela too; once Bela has it, take Bela's |
| `_lib/service/admin/hands.ts` (`recountFinishedMatch`, `reopenCheck`, `reopenMatch`, `roundWins`, `noWinnerAddHandsWarning`; `addHand`/`updateHand`/`deleteHand` return `HandEditOutcome`), `_lib/__tests__/db/finishedMatchEdit.test.ts`; `_lib/ui/adminEntry.ts` (`dostaAskHand`, `handPlace`), `_ui/admin/TablePhone.tsx` and `league/[leagueId]/daily-standings/table/[roundId]/page.tsx` (`askDosta`), `_lib/__tests__/adminEntry.test.ts` | **A corrected match goes back in play**, Treseta's own since 14 Nov 2026 (Bela has neither): a finished match closed by Završi meč that an admin's change leaves without a winner is played again at its table, with the time it had left, when it is a table of tonight and nothing came after it (no later match with a hand, no next Kolo, not even a draft); a closed table opens again and the standings and ratings drop it until it closes. Otherwise it stays without a winner and the admin adds its hands. A match closed by Vrijeme partije goes to the team with more points after a change, as Bela's `finishedMatchWinner` does. Bela's Otključaj partiju is a different, manual route. After a correction that puts the match back in play, both scorepads still ask "s ovim dosta" about a corrected custom hand: they find it by its place in the match (`dostaAskHand`), since the reopened match's hands have new ids (Treseta #1, 16 Nov 2026). When Bela's hands.ts comes over, keep this |
| `_lib/service/tournament/attendance.ts` (`setTableOutcome`, `applySkip`'s `by`), `api/admin/tournaments/[id]/tables/[tableId]/outcome/`, `_fetchers/tournament.ts` (`setTableOutcomeAPI`), `_ui/tournaments/admin/DayAdmin.tsx` (Uredi ishod, `OutcomePicker`), `_lib/tableState.ts` and `_lib/service/tournament/load.ts`/`views.ts` (`attendance_by_admin`: "Dodijeljena pobjeda", "Odluka admina"), `_lib/__tests__/db/tableOutcome.test.ts` | **Uredi ishod**, Treseta's own since 13 Nov 2026 (with Vrati stol, not in Bela yet): the admin or the organizer gives a skipped or no-show table a team's win (5:0 per match as a no-show, the other team out) or makes it skipped; exclusions and Kolo 1 bans follow (a ban that was lifted comes back rather than a second one), an unpublished draft is made again. Vrati stol and Uredi ishod both send back to the waiting list the teams that came in for the excluded ones and have no published table yet, when the tournament is over its limit (`returnOverflow`, `_lib/__tests__/db/restoreOverflow.test.ts`). Worth building in Bela too; once Bela has it, take Bela's |
| `_lib/tournamentDay.ts` (`NO_SHOW_*_MS`), `_lib/service/tournament/attendance.ts` (`answerAttendance`), `_bootstrap/TournamentAttention.tsx` (`Question`), `_lib/__tests__/tournamentDay.test.ts`, `_lib/__tests__/db/attendance.test.ts` | **Nedolazak za stol: 4, 6, 10 minutes**, Treseta's own since 14 Nov 2026 (Bela: 3, 5, 8): the question comes at 4 and Da, tu su works at once (Bela: both buttons from 5), Ne, nisu došli from 6, and a table with no game and no answer is skipped at 10 minutes. Keep these when Bela's tournamentDay.ts comes over |

Bela's migrations `20261026120000_tournaments`, `20261030120000_turniri_v1`, `20261031120000_tournament_auto_publish`,
`20261107120000_organizer_role`, `20261107180000_open_signups`, `20261107190000_open_signups_check` and
`20261107200000_round_game_minutes` are Treseta's `20261110120000_tournaments`, `20261110120100_game_time` and
`20261110120200_bans_and_organizer`: the same shape by different SQL, since Treseta never had Bela's old unused
`Tournament` tables and creates them instead of altering them.

Still out, for now:

- **Sign-up bans on league nights** (Bela's `de2001c`, DECISIONS #73), as decided on 31 Oct 2026: the bans are the
  tournaments' only. Tu smo, Novo kolo, Novi stol, Uredi stolove, Dodaj ekipu, Nova liga, publishing a Skica and a new
  team don't check them (see [Tu smo without the bans](#tu-smo-without-the-bans)).
- **Gost i poziv**, as decided on 7 Nov 2026 (see [Not copied from Bela](#not-copied-from-bela)). `PlayerFrame.tsx`
  came with the tournament screens, since `PlayerParts.tsx` needs it; nothing else of the guest did.

### Tu smo without the bans

Bela's league Tu smo (`de2001c`, DECISIONS #73) came on 1 Nov 2026 without its ban checks (decided 31 Oct 2026): Tu smo,
Novo kolo, Novi stol, Uredi stolove, Dodaj ekipu, Nova liga, publishing a Skica and a new team don't check bans, the
league's teams carry no `ban`, and Novo kolo has no Zabrana chip or reason (`OutReason` is `absent`, `inactive`, `off`).
Bela's head-to-head (`92df912`) reads a tournament's `rankTeams`, which `_lib/leagueOrder.ts` imports from `_lib/tournaments.ts` since the tournaments came over.

| Files | Left out, or Treseta's |
|---|---|
| `_interfaces/leagueArrival.ts`, `_lib/service/league/arrival.ts`, `_lib/service/league/schedule.ts`, `_ui/home/LeagueArrival.tsx`, `_lib/__tests__/leagueArrival.test.ts` | `MyLeagueArrival` has no `ban`, so `myTonight` takes no viewer and Početna's card has no Zabrana; no `assertMayPlay` in Tu smo or the admin's switches; the test has no `playBan*` case. `LeagueArrival.tsx` formats its times with `leagueClock` (`_lib/dates.ts`) where Bela imports the tournaments' `clockOf` from `_ui/tournaments/DayParts.tsx` |
| `_ui/round/CreateRound.tsx`, `_ui/admin/CreateRoundPhone.tsx`, `_ui/admin/LeaguePhone.tsx`, `_hooks/useLeagueTeams.ts`, `_interfaces/league.ts`, `league/[leagueId]/daily-standings/ui/RoundEditing.tsx` | A banned team's switch, chip, reason and count (`banned`, `playBanChip`, `playBanText`), Uredi stolove's ban note, Novo kolo card's `!t.ban`, and `LeagueTeam`'s / `LeagueTeamDetails`' `ban`. Novo kolo's switch rows keep the conference dot (`TeamLabel`) beside Bela's `TeamChipBadge` |
| `_lib/service/league/leagues.ts`, `_lib/service/round/publication.ts`, `_lib/service/team/create.ts`, `_lib/service/admin/tables.ts`, `api/rounds/generate-multiple/route.ts` | `assertMayPlay`, `assertPlayersMayPlay` and `teamPlayBans` (Nova liga, Dodaj ekipu, the league's teams, publishing a Skica, a new team in a league, Novi stol and Uredi stolove, Novo kolo) |
| `_lib/__tests__/adminGuards.test.ts` | Bela's other new player routes are the tournaments'; `leagues/[id]/arrival` and `leagues/[id]/arrivals` came |
| `_ui/home/LeaveParts.tsx` (Treseta only), `_ui/home/LeagueArrival.tsx`, `_ui/home/PhoneHome.tsx` | The league's part of Bela's `_ui/tournaments/DayParts.tsx`: `leaveButton` (Odlazimo, Ipak otkazujemo) and `LeaveRow` (Odlazimo under Započni igru, with `699984e`'s navy look). `LeagueArrival.tsx` and `PhoneHome.tsx` import them from here; Početna's `here` has no `!ban`. A Bela change to these two in `DayParts.tsx` is carried here |
| `_lib/service/league/arrival.ts`, `_interfaces/leagueArrival.ts`, `_lib/__tests__/leagueArrival.test.ts` | `last_round` (no Tu smo after the night's last round) and Broj kola's `nightRounds` (a night whose rounds are all finished is over) came without `ban` |
| `_lib/service/admin/tables.ts` | `lockLeague` is the advisory lock itself (Bela: through `lockCompetition`), and `deleteNightTables` settles by the league's id |

### Lokacije

Places are one shared list, Lokacije (`Location`: a name, an address and a Google Maps link), which leagues, nights
and tournaments point at (`location_id`), and a league night can be played at two places at once
(`LeagueNight.second_location_id`). The admin splits the teams between them on Podjela (`LeagueNightTeam`, place 1 or
2 per team), and each place has its own Tu smo, Novo kolo, Skica and Objavi, tables (`Round.location_slot`) and view of
Dnevni poredak, while the night's Kolo numbers, the night's table and the season stay one league's. A one-place night
writes no slot and works as before. The plan and decisions are in [LOCATIONS_PLAN.md](LOCATIONS_PLAN.md).

Bela doesn't need it (Bela's DECISIONS #95, 14 Nov 2026): Bela's league keeps one place per night, as three text fields
on the league, the night and the tournament (`location_name`, `location_address`, `location_url`), which Treseta has
dropped (`20261115120000_locations_drop_text`). So it stays Treseta's for good, and unlike Vrati stol or Uredi ishod
it isn't marked "worth building in Bela too".

A Bela change to places or to a night's rounds comes over like this:

- **A place field comes over as `location_id`.** Where Bela reads `location_name`, `location_address` or
  `location_url` of a league, a night or a tournament, Treseta reads its `Location` (`LOCATION_SELECT` and
  `locationOf` in `_lib/nights.ts`; `NightLocation` and `TournamentPlace` carry its `id`). Where Bela writes them,
  Treseta writes `location_id`, and Bela's text fields for a place (`PlaceFields`) are Treseta's `LocationPicker`. A
  new Bela field of a place (a note, a phone) is a question for Lokacije, whether it belongs to the `Location` or to
  the night: the sync stops at it.
- **Migrations:** a Bela migration on the three columns is carried over by what it means, as above, not as SQL. One
  that makes `get_league_standings_by_date` again keeps Treseta's third parameter `p_slot` and its `location_slot`
  filters (`20261114140000_locations_daily_standings`).
- **Broj kola is the whole night's** (your call, 17 Nov 2026). A night's `rounds_per_night` (Bela's DECISIONS #94) is
  one number for both places: each place plays that many Kola on the night's shared numbers. Novo kolo at a place
  counts and numbers that place's own published Kola and offers the ones still missing there (`publishedTonight` and
  `tonightRoundsDefault` take the slot); Tu smo's last round and Početna's Kraj večeri (`lastKoloOut` in `_lib/service/league/schedule.ts`) are per
  place, against the night's number; and the night is over for
  Potvrda dolaska only when every place has finished that many (`nightRounds` in `_lib/service/league/arrival.ts`; a
  place that plays fewer ends the night at 06:00). The night form (`GatheringForm.tsx`) has Broj kola beside Lokacija
  and Druga lokacija, and no Vrati na zadano (Treseta's form dropped it): a Broj kola equal to the league's is the
  league's again.
- **The shared files below** are merged around the place code, as for a small edit. Every query of a night's tables
  stays per place: a (date, round_number) group keys on `location_slot`, and a route that reads or writes a night's
  rounds takes `?slot=`. When a Bela change can't be merged that way (Bela reworks Novo kolo, Skica, publishing or a
  night's tables, and it isn't clear where the place goes), the sync stops at that commit, as for Conferences.

New files (Treseta only):

| Treseta | What it holds |
|---|---|
| `_interfaces/location.ts`, `_lib/locations.ts`, `_lib/service/location/locations.ts`, `api/locations/route.ts`, `api/locations/[id]/route.ts`, `_fetchers/locations.ts`, `_hooks/useLocations.ts` | Lokacije: a place's fields and checks (`locationIdField`, `slotField`), the list with each place's use, add, change and delete (a place in use isn't deleted: `locationRefused`), and the slots (`Slot`, `slotParam`, `slotQuery`). Podjela's pure parts (`splitByConference`, `swapSlots`, `copyText`) |
| `lokacije/page.tsx`, `_ui/locations/LocationsDesktop.tsx`, `_ui/locations/LocationsPhone.tsx`, `_ui/locations/LocationForm.tsx`, `_ui/locations/LocationFields.tsx`, `_ui/locations/LocationPicker.tsx` | The Lokacije screen (admin), and the place picker of Nova liga, Podaci, Datumi (with Druga lokacija) and the tournament form, which can add a place |
| `_interfaces/split.ts`, `_lib/service/league/split.ts`, `api/leagues/[id]/nights/[date]/split/route.ts`, `_fetchers/league/split.ts`, `_hooks/useNightSplit.ts`, `_ui/league/split/SplitDesktop.tsx`, `_ui/league/split/SplitPhone.tsx`, `_ui/league/split/SplitParts.tsx` | Podjela: the next night's split, moving a team (drag, or the menu "… idu na"), Podijeli po konferencijama, Zamijeni lokacije, Kopiraj raspored, and the warning for a team left in a Skica of its old place |
| `_hooks/useNightPlaces.ts`, `_ui/league/PlacePicker.tsx` | Tonight's places in Novo kolo and Skica: the header's Lokacija menu on the computer, the segment on the phone |
| `_hooks/useLocationFilter.ts`, `_ui/league/LocationFilter.tsx` | Dnevni poredak's Sve / place choice, kept per league for the session |
| `_lib/homeCard.ts`, `_ui/home/TonightCards.tsx` | Početna's card on a league night, which one shows (a table, Kraj večeri, a bye or the next table, the night, nothing), and the cards for waiting, Sljedeći stol, Pauza, a quiet night and Nema zakazane večeri |
| `_lib/__tests__/locations.test.ts`, `_lib/__tests__/db/split.test.ts`, `_lib/__tests__/db/arrivalPlaces.test.ts`, `_lib/__tests__/db/placeRounds.test.ts`, `_lib/__tests__/db/dailyPlaces.test.ts`, `_lib/__tests__/db/homeTonight.test.ts`, `_lib/__tests__/db/nightRoundsPlaces.test.ts` | Their tests: Podjela's helpers, the shared Kolo numbers, "Kolo 1/3", Početna's card; against Postgres the split, Tu smo per place, two places' Novo kolo, Skica and Objavi, Dnevni poredak per place, Početna's evening, and Broj kola at two places (each place's last Kolo, the night over when both have played theirs) |
| `prisma/migrations/20261114120000_locations`, `prisma/migrations/20261114140000_locations_daily_standings`, `prisma/migrations/20261115120000_locations_drop_text` (root) | The `Location` table, the new columns and keys, and the places written so far made into Lokacije (the same name is one place); Dnevni poredak per place; the text columns dropped |

Shared files with Treseta's place code, by area:

| Area | Files | Treseta's edit |
|---|---|---|
| A place on leagues, nights and tournaments | `_lib/nights.ts`, `_interfaces/league.ts`, `_interfaces/tournament.ts`, `_lib/service/league/leagues.ts`, `_lib/service/league/nights.ts`, `_lib/service/tournament/tournaments.ts`, `_lib/service/tournament/load.ts`, `_lib/service/tournament/views.ts`, `_hooks/useLeagues.ts`, `_lib/__tests__/nightTimes.test.ts`, `_lib/__tests__/tournaments.test.ts`, `_lib/__tests__/db/tournamentZvanja.test.ts` | `NightLocation` from the `Location` (`LOCATION_SELECT`, `locationOf`, `secondLocationOf`); the league, a night and a tournament take `location_id` where Bela takes the three texts, and a night `second_location_id` (`secondPlaceError`: it needs a first place and isn't the same one; removing it clears the night's Podjela); `exceptionLabel` "Dvije lokacije", `gatheringLabel` with the second place |
| The place forms | `_ui/admin/GatheringForm.tsx`, `_ui/gathering/Gathering.tsx`, `league/new/page.tsx`, `_ui/admin/NewLeaguePhone.tsx`, `league/[leagueId]/manage/LeagueDetailsView.tsx`, `league/[leagueId]/manage/DatesView.tsx`, `_ui/admin/LeaguePhone.tsx` (Datumi), `_ui/tournaments/TournamentForm.tsx` | `LocationPicker` where Bela has `PlaceFields` (and no `EMPTY_PLACE`, `PlaceDraft`, `placePayload`); a night's Druga lokacija (Dodaj drugu lokaciju, the picker with ×) and the note that Podjela places the teams; the night form has no Vrati na zadano; `GatheringLine` shows the second place and the team's own ("(vi)") |
| Početna and Raspored | `_lib/service/league/schedule.ts`, `_interfaces/burza.ts`, `_ui/home/HomeCards.tsx`, `_ui/home/PhoneHome.tsx`, `_ui/home/StartCard.tsx`, `_ui/tournaments/PlayerParts.tsx`, `api/rounds/open/route.ts`, `_fetchers/round/getOpenByPlayerId.ts`, `_hooks/useOpenTable.ts`, `_lib/roundStatus.ts` (`nightKolo`), `raspored/page.tsx` | `MyLeague.secondPlaces`, `slots` and `tonight`; Sljedeća večer's Vaša lokacija, or "X ili Y · Još niste raspoređeni."; Kraj večeri ("Odigrana su sva N kola večeras"); "Kolo 1/3" on the player's table; Početna's card chosen by `homeCard`; Raspored's two places with Vi on the team's; `NoTournamentCard` is a `QuietCard` |
| Tu smo | `_lib/leagueArrival.ts`, `_interfaces/leagueArrival.ts`, `_lib/service/league/arrival.ts`, `api/leagues/[id]/arrivals/route.ts`, `_fetchers/league/arrival.ts`, `_ui/home/LeagueArrival.tsx`, `_lib/__tests__/leagueArrival.test.ts` | On a two-place night a team Podjela hasn't placed gets Javi se adminu with Tu smo locked, and the server refuses its Tu smo with a 400 (`NO_PLACE_ERROR`, `asksAdmin`, `no_place`); the admin's arrivals and the night's last Kolo are per place (`slot`) |
| Novo kolo, Skica and Objavi | `_lib/service/round/publication.ts`, `_lib/roundStatus.ts` (`placeLastPublished`), `_lib/service/round/insertPairRounds.ts`, `_lib/service/round/createRoundDraft.ts`, `_lib/service/round/smoking.ts`, `_lib/matching/smokingTables.ts`, `_interfaces/round.ts`, `api/rounds/generate-multiple/route.ts`, `api/leagues/[id]/nights/[date]/draft/route.ts`, `api/leagues/[id]/nights/[date]/approve/route.ts`, `api/leagues/[id]/nights/[date]/publish/route.ts`, `api/leagues/[id]/create-round-draft/route.ts`, `api/leagues/[id]/smoking/route.ts`, `_fetchers/round/publication.ts`, `_fetchers/round/createRoundDraft.ts`, `_fetchers/round/createMultipleRounds.ts`, `_fetchers/league/smoking.ts`, `_hooks/useNightDraft.ts`, `_ui/round/CreateRound.tsx`, `_ui/round/SmokingTables.tsx`, `_ui/admin/CreateRoundPhone.tsx`, `_ui/admin/DraftPhone.tsx`, `league/[leagueId]/manage/DraftView.tsx`, `_lib/__tests__/smokingTables.test.ts` | Everything per place (`location_slot`, `?slot=`): the teams are the place's (`checkPlace` refuses others and a two-place night without a place), each place publishes its own Kola on the night's shared numbers (Kartaš 7, 8, 9 and Lanterna 7, 8), Novo kolo's saved setup is per place (`CreateRoundDraft.slot`), the smoking tables are remembered only on a one-place night; the place in the eyebrow, the button ("Kreiraj kolo · X · N ekipa") and Skica's notes |
| A night's tables and Kola | `_lib/service/admin/tables.ts`, `_lib/service/admin/hands.ts` (`reopenCheck`), `api/admin/leagues/[leagueId]/tables/route.ts`, `api/admin/leagues/[leagueId]/rounds/route.ts`, `_fetchers/admin/daily.ts`, `league/[leagueId]/daily-standings/ui/RoundEditing.tsx`, `league/[leagueId]/manage/RoundsView.tsx`, `_lib/ui/adminTonight.ts`, `_lib/__tests__/adminTonight.test.ts` | A table keeps its place; Novi stol adds at the round's place; the Kola list merges a published Kolo across places and keeps a Skica row per place (`kolaRows`, the place under the name, "Briše se na obje lokacije"); deleting a Kolo at one place or both; a corrected match's "next Kolo" is its place's |
| Dnevni poredak | `_lib/service/league/getStandingsByDate.ts`, `api/leagues/[id]/daily-standings/route.ts`, `_fetchers/league/getStandingsByDate.ts`, `_hooks/useStandings.ts`, `league/[leagueId]/daily-standings/page.tsx` | Sve / place (`?slot=`): a place ranks its own teams from 1; the night's tables and Kola by place; no conference filter on a two-place night; the admin's pencil only in a place's view |
| Upravljanje ligom and Večer | `league/[leagueId]/manage/page.tsx`, `_ui/admin/ManagePhone.tsx`, `_ui/admin/LeaguePhone.tsx`, `_ui/admin/AdminTonight.tsx` | The Podjela tab (grey on a one-place night, with the count of teams without a place); the place in Novo kolo's and Skica's headers; Kola before Ekipe on the computer and the phone (Bela: Ekipe first); the phone's Večer with a box per place (`PlacesCard`) |
| The app around it | `_lib/auth/permissions.ts`, `_lib/__tests__/permissions.test.ts`, `_ui/sp/DesktopShell.tsx`, `_styles/tokens.ts`, `_ui/sponsors/AdminSponsorParts.tsx` | `location.create` (admin and organizer) and `location.manage` (admin); Lokacije in the menu; `color.gold` and `tint.creamOnNavy[10]`; `SponsorEmpty` takes an `icon` (Lokacije's empty list) |

The database part (`Location`, the `location_id` columns, `LeagueNightTeam`, `Round.location_slot`,
`CreateRoundDraft.slot`) is under Database.

### Adding a difference

1. Make the change on `master`, as small as it can be: a constant in `_lib/game/scoring.ts` or a field in
   `_lib/brand.ts` beats an edited shared file.
2. Add it to the table of its kind: the Treseta path, the Bela counterpart and what stays different. A file that
   differs from Bela without a row here is reported as drift every night.
3. To keep a Bela feature out of Treseta, add its paths to Not copied before Bela commits it, and say what happens to
   its migration and to the shared files it touches (a menu entry, a link on Home).

## Sync log

The nightly sync adds a row when it brings something over or stops.

| Date | Bela commits | Result |
|---|---|---|
| 11 Oct 2026 | up to `4bf68ad` | The transition ([docs/arhiva/TRANSITION_PLAN.md](docs/arhiva/TRANSITION_PLAN.md)) |
| 13 Oct 2026 | none | Stopped before the first commit: the run started in its own worktree and couldn't write to `.claude/worktrees/bela-sync` |
| 14 Oct 2026 | `4bf68ad..e39abc1` (45) | 41 came over, 3 skipped (decision logs, Burza test data), the Frankfurt merge already here; 7 migrations, untested |
| 16 Oct 2026 | `b9afd0e..07a790f` (14) | Bela's history was rewritten (`e39abc1` is now `b9afd0e`, same tree). All 14 came over: the admin's phone screens, with Treseta's hands on TablePhone and the conference switch and dots on the phone; 2 migrations (`create_round_draft`, `night_location`) |
| 17 Oct 2026 | `07a790f..91f1537` (1) | Sponsors came over (Sponzori under Admin, a league's Sponzori tab, logos on Početna and a live round), the conference code kept around Upravljanje ligom's new tab; 1 migration (`sponsors`) |
| 19 Oct 2026 | `91f1537..b6cd20c` (15) | 13 came over, 2 skipped (Bela's bell icons): sponsor logo backgrounds, shapes and cropping, profile photos for players and teams (avatars in the standings, Rejting and a round's tables, next to the conference dots), the install sheet per browser (Treseta's branding), more rounds a night with Skica A, B, C, Uredi stolove and Slobodna runda (5:0 byes), standings places as numbers; Bela's bell not copied; 4 migrations (`sponsor_background`, `sponsor_background_two`, `profile_photos`, `draft_order`) |
| 20 Oct 2026 | `b6cd20c..da577ba` (1) | Came over as Bela has it: a tap on a player's or a team's photo opens it over the whole screen (PhotoViewer); no migration |
| 20 Oct 2026 | `da577ba..5fc3bf5` (1) | Came over as Bela has it: the admin's photo controls on the computer move onto the header avatar's badge and panel (PhotoAdmin); no migration |
| 21 Oct 2026 | `5fc3bf5..4b0be31` (1) | Came over as Bela has it (the scorepad page's scoring import kept): Tko igra ovu rundu? every time an admin opens a table's scorepad, a finished round's lineup correctable with a ratings replay; no migration |
| 25 Oct 2026 | `4b0be31..d0777b1` (13) | 12 came over, 1 skipped (Bela's root `CLAUDE.md`), `DECISIONS.md` left out: Zadnje večeri open that night's Dnevni poredak with the team highlighted (with the conference filter), the phone's standings rows as B1 (the conference dot kept in the name), pairing by average age (also inside every conference), `npm run ages:report`, scorepad hands as cards; no migration. Checks incomplete: the sandbox stopped `npm ci`'s Prisma engine download |
| 26 Oct 2026 | `d0777b1..c2969e5` (5) | Stopped at `79d735a` (the tournaments, not decided). 5 came over: the account lock after 20 failed logins (1 migration, `login_failure`), Dodaj stol takes the lowest free table number, Sljedeća večer for an inactive team, Dodaj ekipu filters the league's teams on the phone, and the lead bar's test with Treseta's 41 (the bar was already Treseta's) |
| 27 Oct 2026 | `c2969e5..c354458` (11) | The tournaments not copied: 7 skipped (parts 1–4, `DECISIONS.md`, the click-through fixes, Dodaj kolo), and from parts 5 and 6 only the rating chip on Početna, `StartCard.tsx` (with the conference dots), Skica kola's two-line names and a page's tab kept in its address; Bela's `/api/teams/[id]` 500 and the scorepad hands as rows (no lead bar, so Treseta's `LEAD_BAR_FULL` went); no migration |
| 29 Oct 2026 | `c354458..4b43d06` (2) | Both came over: Najbolje mjesto counts finished leagues only, and Obriši ekipu without its tournament check; no migration |
| 30 Oct 2026 | `4b43d06..9a16ca9` (2 of 11) | Stopped at `14f988f` (Turniri v1: Vrijeme partije for league matches changes the game rules, not decided). 2 came over: Obriši ekipu disabled with its reason (without the tournament check), and a closed table's point difference on the Kolo tab (with the conference dots); no migration |
| 30 Oct 2026 | `9a16ca9..6c84c4b` (9) | All 9 skipped (Turniri v1): decided that league matches don't get Vrijeme partije and the sign-up bans stay with the tournaments, so nothing outside tournaments was left; `DECISIONS.md` not copied; no migration |
| 31 Oct 2026 | `6c84c4b..bed3e29` (6 of 27) | Stopped at `de2001c` (league Tu smo also makes the sign-up bans keep teams from league nights, not decided). The 6 before it skipped: the cron clock backup (tournaments and Vrijeme partije), `CHANGELOG.md` twice, Kolo drafts and Automatska kola (tournaments, with migration `tournament_auto_publish`), `DECISIONS.md`; no migration |
| 1 Nov 2026 | `bed3e29..92df912` (2 of 25) | Stopped at `3b85bfa` (Gost i poziv: a guest's Početna is built on the tournaments, Turniri · Liga, PlayerFrame and TournamentsOverview, and the league's season table needs a login; not decided). 2 came over: league Tu smo without the bans (1 migration, `20261031180000_league_arrival`, Bela's SQL), and the standings' head-to-head with `rankTeams` carried into `_lib/leagueOrder.ts` |
| 10 Nov 2026 | tournament files from `d2a0b98` | **Turniri brought over by hand** (not a nightly run): the schema and 3 migrations, the organizer role, Vrijeme partije (45 min, +5 a raised target), the tournament logic, 21 routes and 31 screens. Treseta's rules kept: 41 with "s ovim dosta", a no-show scored as a bye (5 : 0), no zvanja, no `TeamScore.tournament_id`. Otključaj partiju and Gost i poziv still out |
| 11 Nov 2026 | none (Treseta's own) | **Zvanja** (docs/arhiva/ZVANJA_PLAN.md, branch `zvanja`): 3 and 4 per team per hand, Bela's Zvanja step and admin steps with Treseta's values and check, and Bela's tournament switch `declarations` brought back. The files above lose their "without zvanja" difference; Bela's `_lib/bela/declarations.ts` isn't copied |
| 7 Nov 2026 | `92df912..a0686e1` (42) | Run by hand after the nightly stop at `3b85bfa`: Gost i poziv decided not copied for now. 19 came over (6 adapted by hand): Registracija s Googleom (without `?next=`), Datumi (Uredi večer moves a night, Obriši večer i kola, Dodaj večer, the phone sheet), Okupljanje (1 migration, `20261101120000_league_gathering_time`, Bela's SQL), Nađi zamjenu until Tu smo opens, Dnevni poredak lists arrived teams, Odlazimo and Ipak otkazujemo as buttons and under Započni igru (`LeaveParts.tsx`), the round-close tests and the finished-match guard on Treseta's hands, Natrag na kolo after a reload, Igrači A–Ž / Najnoviji, the sign-up checks and limit, no Tu smo after the last round, the phone's Back closing sheets, the bold Tu smo note. 23 skipped: Gost i poziv (4), tournaments (14; the Burza test part of `726b292` came separately), Vrijeme partije, `CHANGELOG.md` (2), `CLAUDE.md`, and `699984e` (its look came with `LeaveRow`) |
| 8 Nov 2026 | `a0686e1..88425c3` (9 of 22) | Stopped at `28d19f2` (Organizator: a tournament role on a new role→capability foundation across about 80 shared files, with a migration; not decided). 4 came over: the admin's no-winner warning (Meč ostaje bez pobjednika?, Spremi / Obriši svejedno) on Treseta's `winner_side` and hands, Raspored scrolling on Android (twice; Bela's mistaken revert of the warning left out), Vidljivost slike behind the photo. 5 skipped: `CHANGELOG.md` (4) and Bela's restore `ba7fb02` (already here); no migration |
| 11 Nov 2026 | `a0686e1..88425c3` (merged) | The four commits the 8 Nov run left on `bela-sync` were rebased onto the tournaments and merged into `master`. Five conflicts, each resolved by keeping both sides: the no-winner warning keeps the organizer's `refuseUnlessMyHand` and takes Bela's `allow_no_winner`, Vidljivost slike keeps the `team.moderate` guard, and the sync state took `88425c3`. The Organizator question the run parked is answered: the tournaments brought the whole role→capability foundation on 10 Nov. Unit tests (552), `tsc`, ESLint and `next build` pass; the `db/` tests were not run, since the repo's generated Prisma client belongs to the `zvanja` branch being built in parallel |
| 12 Nov 2026 | `88425c3..e7f0047` (42) | 25 came over (13 adapted by hand), 17 skipped. Of `88425c3..d2a0b98` (copied by hand on 10 Nov) only what the copy missed: the team routes' `requireCan`, the public username (#88), Otključaj partiju on Treseta's hands, the 16 px phone fields, the install sheet's week, Burza's number for logged-in players (Prijava instead of the guest sheet), the same hand from two phones (on Treseta's hand entry); 13 skipped as already here (or empty, `6040549`), and `d2a0b98` (`CHANGELOG.md`). After it: Google not linking a password account, the night after midnight, the Kalkulator ("do 41"), the tournament card for non-players, Sakrij broj prijava (migration `20261111180000_hide_entries`), Broj kola po večeri (migration `20261112120000_night_rounds`, without bans), Novo kolo after published rounds; the scorepad card tap only as `ScorePanel`'s prop (Bela's caller). Skipped: `reports/` (2), `CHANGELOG.md` (`fc74fd9`). Migrations tested on a fresh local database only |
| 13 Nov 2026 | `e7f0047..b3443b9` (1) | Came over adapted: the double-tap guard on Upiši igru only (the team cards stay without `onPick`, no Tko je zvao); `CHANGELOG.md` not copied; no migration |
