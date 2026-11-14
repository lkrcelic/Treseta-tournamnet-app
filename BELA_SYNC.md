# Syncing with the Bela app

The Bela app (`../Bela-Treseta-Tournamnet-app`) is primary: design, features and fixes are built there once and come
here every night. Only the differences listed under [Differences from Bela](#differences-from-bela) stay Treseta's
own; everything else is kept identical to Bela.

## Sync state

| | |
|---|---|
| Bela branch | `development`, read through the remote `bela` (the local Bela repo). Only commits come over, never Bela's uncommitted work |
| Last synced Bela commit | `88425c3` (7 Nov 2026). The tournament files are ahead of it, see [Bela's work waiting to come over](#belas-work-waiting-to-come-over) |
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

Every Bela commit up to `88425c3` (7 Nov 2026) came over or was skipped by 8 Nov 2026. Decisions for Bela work that
touches Treseta's differences before it comes over go here.

**The tournaments were brought over by hand on 10 Nov 2026** (see [Turniri](#turniri)), copied from Bela's
`development` as it stood at `d2a0b98`. So the tournament files are ahead of the last synced commit: everything Bela
did to them up to `d2a0b98` — Organizator, Otvorene prijave, Obriši kolo, the Kolo full-screen, the status chips
— is already here, while the 14 tournament commits the earlier runs skipped (`79d735a..6c84c4b` and after) never
came as commits at all.

What the next run does with `88425c3..d2a0b98`: a commit that only touches tournament files is already here, so its
cherry-pick either applies cleanly to the same end state or comes up empty — either way nothing is lost, and an empty
one is skipped with that reason. A conflict there means Bela changed the same lines after this copy: take Bela's
side, keeping the Treseta rules in the table below. Commits that touch other files (Burza's phone numbers, the
install sheet, the hands-changed question) come over as usual, and Otključaj partiju is listed under Turniri as
still to come.

- **Organizator is decided**, which the run of 8 Nov 2026 left open (`28d19f2`, DECISIONS #86): the whole
  role→capability foundation came over with the tournaments on 10 Nov 2026 — `_lib/auth/` (`permissions.ts`,
  `roles.ts`, `ownership.ts`, `forbidden.ts`), `requireCan`, `ForbiddenError` → 403, `useCan` / `useManagePhone`, the
  three privacy steps and the Rola picker — and `ORGANIZER` and `Tournament.created_by` with it. Nothing of it waits
  any more, and the Bela commits that build on it come over as usual.

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
| `_lib/service/ongoingResult/*` (Treseta only) | `_lib/service/ongoingBelaResult/*` | Saves and edits a hand with Bela's row locks; refuses a hand once the match is over, a "s ovim dosta" call that can't stand, and a player's custom hand at a table "na prolaz" (`matchState.ts`: `ongoingMatchState` reads the table's `match_end`, `assertPlayersHand`; `update.ts` takes `admin`) |
| `_lib/service/ongoingMatch/getOneWithResults.ts`, `_lib/service/ongoingMatch/getRoundId.ts`, `_lib/service/match/finishOngoingMatch.ts`, `_lib/service/admin/hands.ts` | same paths | Bela's logic on Treseta's hand tables |
| `_store/game/resultStore.ts` (Treseta only) | `_store/bela/resultStore.ts`, `_store/bela/announcementStore.ts` | The keypad: the 11-split and Custom (Kaput at a table "na prolaz": `setKaput`), and each team's zvanja (3 and 4, `addZvanje`, `clearZvanja`) where Bela has its announcement store; persisted with `version: 1` |
| `_fetchers/ongoingResult/*`, `api/ongoing-result/*` (Treseta only) | `_fetchers/ongoingBelaResult/*`, `api/ongoing-bela-result/*` | Fetchers and routes for a hand |
| `ongoing-match/[matchId]/ongoing-result/layout.tsx`, `…/ui/WizardHeader.tsx`, `…/ui/pages/ScorePage.tsx`, `…/ui/pages/ZvanjaPage.tsx` (Bela's `AnnouncementPage.tsx`) | same paths, plus the trump-caller step | Hand entry in two steps, Zvanja (3 and 4) and Igra (the keypad with Custom where Bela has Štiglja, Kaput at a table "na prolaz"; the header is Bela's `TeamValueBoxes`, whose Treseta `zvanja` prop ends each box in a `ZvanjaStrip`, "Zvanja +7 · Σ 14" or "Bez zvanja · Σ 4", in the room of Bela's "Σ" line; `ZvanjaStrip` lives in `ongoing-match/ui/WizardParts.tsx`, and the admin's phone and both desktop panels show it too); a table "bez zvanja" and a custom hand skip Zvanja. Dalje and Natrag replace the step instead of pushing it, so the scoreboard stays one history entry behind. The `new/…` and `[resultId]/…` pages are shared |
| `ongoing-match/ui/handFlow.ts`, `ongoing-match/ui/HandEntryPanel.tsx`, `ongoing-match/[matchId]/page.tsx` | same paths | The desktop entry panel (with a row of 3, 4 and Obriši zvanja) and the hand rows (each hand's total), without "Tko je zvao"; after a custom hand the scoreboard asks "Je li netko zvao „s ovim dosta”?", and a raised target shows as the "Do 51" flag. At a table "na prolaz" (`roundData.match_end`): Kaput on the Custom key, no question, and the `LevelFlag` on a level score at the target |
| `ongoing-match/ui/MatchEnd.tsx` (Treseta only) | none | The "s ovim dosta" question (a bottom sheet), the "Do 51" flag and "na prolaz"'s "Izjednačeno · još jedna igra" (`LevelFlag`), used by the scoreboard and the admin scorepad |
| `_lib/ui/adminEntry.ts`, `league/[leagueId]/daily-standings/table/AdminEntryPanel.tsx` | same paths | The admin scorepad: Normal and Custom, where Bela has "Ručni unos"; Custom's hint names "s ovim dosta" ("za ispravak" at a table "na prolaz": the panel's `naProlaz`; no Kaput for the admin). `levelAtTarget` for the "na prolaz" flag. Zvanja as Bela's shape (`addZvanje`, `clearZvanja`) with 3 and 4 and Treseta's check, and the row hidden at a table "bez zvanja". `manualFields` (the phone's Custom sheet) takes 0 to `CUSTOM_HAND_MAX` (Bela: 0 to 9999). `adminEntry.ts` also holds `roundBackBy` (Natrag na kolo after a reload), which Bela keeps in the not copied `_lib/ui/tableScope.ts` |
| `_ui/admin/TablePhone.tsx` | same path | The admin's phone scorepad on Bela's board and sheets: Bela's korak 2 (zvanja: 3 and 4) and korak 3 (the keypad, the 11-split) without its korak 1 (the trump caller, opened as 2); a table "bez zvanja" opens on 3 (Bela's redirect from a Korak 2 or 3 without a hand isn't here); Natrag na kolo reads `roundBackBy` from `adminEntry.ts`; Custom (0 to 99, a custom hand) where Bela has Ručno and Ručni unos; after a custom hand the "s ovim dosta" question (`DostaPrompt`, through `runSheet`'s `after`, before Bela's `anyway` and `allow`), and the "Do 51" flag on the board, or `LevelFlag` (`levelAtTarget`); `dostaCallers` gets the pad's `matchEnd` (no question "na prolaz") |
| `_bootstrap/refreshUser.ts`, `_utils/resetStores.ts` | same paths | No announcement store |
| `_lib/__tests__/`: `scoring`, `serverHand`, `handEntryStores`, `scoreboardMatch`, `adminEntry`, `tableOverview`, `roundClose`, `finishedMatchEdit` tests, `db/roundClose`, `db/finishedMatchEdit`, `db/tournamentNaProlaz`, `helpers/handEntry.ts` | same names | Tests of Treseta's rules (`tableOverview`: Treseta's hands, 41 and Custom's 0–99; the `db/` tests play custom hands to 41 and a bye worth `2 × BYE_MATCH_POINTS`; `roundClose` has no tournament table of one match) |

### Shared files with a small edit

| File | Treseta's edit |
|---|---|
| `_hooks/useStartGame.ts`, `round/lineup/[roundId]/page.tsx`, `league/[leagueId]/daily-standings/table/TablePreview.tsx` | `1001` → `MATCH_THRESHOLD` |
| `league/[leagueId]/daily-standings/table/[roundId]/page.tsx` | `1001` → `MATCH_THRESHOLD` (the comment says "Custom" for "Ručni unos"); after a custom hand `save` passes `run` an `after` (before Bela's `anyway` and `allow`) that opens the "s ovim dosta" question (`DostaPrompt`, `askDosta` and `pickDosta`); the "Do 51" flag (`TargetFlag`), or "na prolaz"'s `LevelFlag`, next to the admin pill; a match tab adds "· do 51"; `dostaCallers` gets `pad.matchEnd`, and `AdminEntryPanel` its `naProlaz` |
| `_lib/service/admin/recalc.ts`, `_lib/service/ratings/ratings.ts` | The ratings read each match's `winner_side` through `ratedMatch`, so a "s ovim dosta" win with fewer points is a win (Bela compares the points). `recalc.ts` also has `RATINGS_FROM`, below |
| `_lib/service/round/insertPairRounds.ts` | Bye matches `BYE_MATCH_POINTS : 0` (Bela: `301 : 0`), threshold `MATCH_THRESHOLD` |
| `ongoing-match/ui/useMatchSides.ts` | Imports `TeamSide` from `_interfaces/side` |
| `_interfaces/round.ts`, `_interfaces/adminHand.ts` | A table's `match_end` (`RoundExtendedResponseValidation`) and the pad's `matchEnd` ("na prolaz", see Game rules) |
| `_store/ongoingMatchStore.ts` | The hands field is `results` (Bela: `belaResults`) |
| `_lib/service/admin/recalc.ts` | `RATINGS_FROM` = 1 Aug 2025, so the whole Treseta history is rated (Bela: 7 Oct 2025) |
| `_lib/rating/glicko2.ts` | One comment: "for teams of two" (Bela: "for Bela teams of two") |
| `next.config.mjs` (root) | Redirects the old `/match/:id` to `/` |
| `package.json`, `package-lock.json` (root) | The name `treseta-tournament-app`, and `build` runs `node scripts/previewAdmin.js` after the migrations. On a lock file conflict, take Bela's lock file and put the two names back |
| `.gitignore` (root) | Also ignores `.env`, `/backups/` and `/.claude/` |

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
[CONFERENCES_PLAN.md](CONFERENCES_PLAN.md).

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
| `prisma/schema.prisma` | Own version | Bela's schema with Treseta's hand tables (`Result`, `OngoingResult`: `team1_game_points`, `team2_game_points`, `custom`, `dosta_side`, and each team's zvanja `team1_zvanja3`, `team1_zvanja4`, `team2_zvanja3`, `team2_zvanja4`) and `Match.winner_side`, without Bela's announcement tables and without `TeamScore.tournament_id` (see Turniri). `Tournament.declarations` and `Round.declarations` are Bela's; `Tournament.match_end`, `Round.match_end` and the `MatchEnd` enum (migration `20261111160000_match_end`) are Treseta's, with `score_threshold`. Bela's changes to the other models are merged in. The datasource also has `directUrl = env("DATABASE_URL_UNPOOLED")`, so migrations use Neon's direct connection (Bela has only `url`). Treseta also has the `Conference` table and `LeagueTeam.conference_id` (see Conferences) |
| `prisma/migrations/**` | Treseta only | This database's history. Bela's migrations are never copied: a Bela schema change gets a Treseta migration with Bela's SQL adapted to this schema, named with a timestamp after the newest migration here. Bela's names can collide with Treseta's: Bela's `20261011120000_league_nights_burza` has the timestamp of Treseta's `20261011120000_match_like_bela`, so it came as `20261011233000_league_nights_burza`, and Bela's `20261014120000_round_status` has the timestamp of Treseta's `20261014120000_s_ovim_dosta`, so it came as `20261014130000_round_status` |
| `prisma/seed.ts` | Own version | The Treseta seed (users `admin` and `player`, a league of 8 teams in two conferences, playing 16 Thursday nights from five weeks before the last Thursday). Seed data for new Bela tables is added here |
| `prisma/usefulQueries/**` | Own version | Treseta's queries, with `transition_checks.sql`. Bela's aren't copied |

### Repository files

| Path (root) | Kind |
|---|---|
| `README.md`, `ProcessFlow.md`, `Task.md`, `.windsurfrules` | Own version |
| `BELA_SYNC.md`, `TRANSITION_PLAN.md`, `CONFERENCES_PLAN.md`, `.env.example` | Treseta only |
| `scripts/previewAdmin.js` | Treseta only: on a Vercel preview, makes `lkrcelic` (password `sifra`) an admin on the preview's Neon branch, and fails the build if that database is production |
| `public/card.png` | Treseta only, left from the old app and unused |

### Not copied from Bela

- `public/bell.webp`, Bela's bell (see Branding).
- `.env` (Bela tracks it; here it is ignored), `next-env.d.ts` (ignored here), `.idea/`, `bela-tournament-app.zip`,
  `tmp-file.ts`, `skills-lock.json`, `backups/`, `.claude/`.
- Bela's documents: `PLAN.md`, `DECISIONS.md`, `BACKEND_REVIEW.md`, `REFINEMENTS.md`, `TEST_REPORT.md`, `BLOCKERS.md`,
  `RATING_INTEGRATION.md`, `CLAUDE.md`, and any other Markdown file Bela adds at its root.
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
  in `_lib/nights.ts` and its test in `_lib/__tests__/nightTimes.test.ts`; and `shadow.playingCard` in
  `_styles/tokens.ts`.
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
| `_lib/tournamentDay.ts`, `_lib/service/tournament/attendance.ts`, `_bootstrap/TournamentAttention.tsx`, `_ui/tournaments/DayParts.tsx` | Nedolazak za stol: `NO_SHOW_SCORE = [BYE_MATCH_POINTS, 0]`, every match of the table written at `MATCH_THRESHOLD` with `winner_side`, and the texts reading the score (Bela: `1001 : 700`) |
| `_lib/gameTime.ts`, `_lib/service/match/timeLimit.ts` | Vrijeme partije: `GAME_MINUTES_DEFAULT = 45` and `TARGET_RAISE_MINUTES = 5` for every raise of the target or "na prolaz" level score (`MatchState.extensions`, `matchDeadline`, `syncDeadline`), which Bela has no rule for; `gameMinutesOf` reads the Kolo's minutes, then its tournament's, then its league's |
| `_interfaces/tournament.ts`, `_ui/tournaments/TournamentForm.tsx`, `_ui/tournaments/TournamentParts.tsx`, `_ui/tournaments/PlayerParts.tsx`, `_lib/tournaments.ts` | Zvanja as Bela's (`declarations`, the Zvanja choice, the "bez zvanja" chip and labels), but `rulesLabel(declarations)` reads `41 · zvanja · s ovim dosta` (Bela: `1001 · zvanja`), and `declarations` in the request defaults to true. The form's Vrijeme partije starts at `GAME_MINUTES_DEFAULT` (Bela: 35) |
| `_lib/service/tournament/kola.ts`, `_lib/service/tournament/tournaments.ts`, `_lib/service/tournament/views.ts`, `_lib/service/tournament/attendance.ts`, `_lib/service/admin/tables.ts`, `_lib/service/ongoingMatch/create.ts`, `_lib/service/round/finish.ts` (`lockRound`), `_lib/service/round/insertPairRounds.ts` (`createByeMatches`), `ongoing-match/ui/MatchEnd.tsx` (`TargetFlag`'s `base`), and the five files above | Igra se do and Kraj partije, Treseta's own: `score_threshold` (41 or 51) on the tournament, copied to a Kolo's tables like `declarations`, put on a match by `createOngoingMatch` from the table, and on a bye's and a no-show's matches; `match_end` the same way (tournament → Kolo's tables, `tables.ts` for a new table, drafts on a change), but read from the table; the form's Igra se do and Kraj partije choices and their grey notes (`gameLengthNote`, `matchEndNote`), "· do 51" and "· na prolaz" in the lists, `rulesLabel(declarations, threshold, matchEnd)` |
| `_ui/tournaments/PlayerParts.tsx`, `_ui/tournaments/SignUpSheet.tsx` | Prijavi se without an account goes to `/login` (Bela: the "Sjedni za stol." sheet, `useGuestSheet`), and the invitation links the tournament's page and names `BRAND` (Bela: Registracija's link, "Belatronika") |
| `_ui/tournaments/admin/KolaDesktop.tsx` | Novo kolo's team rows carry `conferenceId: null`: a tournament has no conferences |
| `_lib/service/tournament/attendance.ts` (`restoreTable`), `_lib/service/tournament/kola.ts` (`dropTables` exported), `api/admin/tournaments/[id]/tables/[tableId]/restore/`, `_fetchers/tournament.ts` (`restoreTableAPI`), `_ui/tournaments/admin/DayAdmin.tsx` (`TableStates`' Vrati stol and its `onChanged`, passed by `KolaDesktop.tsx` and `ManageTournamentPhone.tsx`), `_lib/__tests__/db/attendance.test.ts` | **Vrati stol**, Treseta's own since 13 Nov 2026 (a production fix, not in Bela yet): the admin or the tournament's organizer brings a skipped or no-show table back in play (open, attendance `PRESENT` by the admin, the no-show's matches gone), its excluded teams back and their Kolo 1 ban lifted, and an unpublished draft dropped. Worth building in Bela too; once Bela has it, take Bela's |
| `_lib/tournaments.ts` (`koloTimes`), `_lib/gameTime.ts` (`elapsedLabel`, `durationLabel`), `_lib/service/tournament/load.ts` (`closed_at`), `_lib/service/tournament/views.ts` (`KoloView.started_at`, `ended_at`), `_interfaces/tournament.ts` (`KoloView`), `_ui/tournaments/admin/KoloTimer.tsx`, `_ui/tournaments/admin/KolaDesktop.tsx`, `_ui/tournaments/admin/ManageTournamentPhone.tsx`, `_lib/__tests__/tournaments.test.ts`, `_lib/__tests__/gameTime.test.ts` | **Vrijeme kola**, Treseta's own since 13 Nov 2026 (not in Bela yet): the admin's timer of a Kolo, from its publishing to its last table's close (the latest match end or no-show/skip). On the computer the side card Kolo N traje has the big timer (od 20:14) and Kolo je trajalo 52 min (20:14 – 21:06) once it is played, and the Kolo over the whole screen a timer chip; on the phone the navy card has it beside the tables' bar, the Kolo's screen a chip, the list of Kolos the time after the tables. Worth building in Bela too; once Bela has it, take Bela's |
| `_lib/service/admin/hands.ts` (`recountFinishedMatch`, `reopenCheck`, `reopenMatch`, `roundWins`, `noWinnerAddHandsWarning`; `addHand`/`updateHand`/`deleteHand` return `HandEditOutcome`), `_lib/__tests__/db/finishedMatchEdit.test.ts` | **A corrected match goes back in play**, Treseta's own since 14 Nov 2026 (Bela has neither): a finished match closed by Završi meč that an admin's change leaves without a winner is played again at its table, with the time it had left, when it is a table of tonight and nothing came after it (no later match with a hand, no next Kolo, not even a draft); a closed table opens again and the standings and ratings drop it until it closes. Otherwise it stays without a winner and the admin adds its hands. A match closed by Vrijeme partije goes to the team with more points after a change, as Bela's `finishedMatchWinner` does. Bela's Otključaj partiju is a different, manual route. When Bela's hands.ts comes over, keep this |
| `_lib/service/tournament/attendance.ts` (`setTableOutcome`, `applySkip`'s `by`), `api/admin/tournaments/[id]/tables/[tableId]/outcome/`, `_fetchers/tournament.ts` (`setTableOutcomeAPI`), `_ui/tournaments/admin/DayAdmin.tsx` (Uredi ishod, `OutcomePicker`), `_lib/tableState.ts` and `_lib/service/tournament/load.ts`/`views.ts` (`attendance_by_admin`: "Dodijeljena pobjeda", "Odluka admina"), `_lib/__tests__/db/tableOutcome.test.ts` | **Uredi ishod**, Treseta's own since 13 Nov 2026 (with Vrati stol, not in Bela yet): the admin or the organizer gives a skipped or no-show table a team's win (5:0 per match as a no-show, the other team out) or makes it skipped; exclusions and Kolo 1 bans follow (a ban that was lifted comes back rather than a second one), an unpublished draft is made again. Vrati stol and Uredi ishod both send back to the waiting list the teams that came in for the excluded ones and have no published table yet, when the tournament is over its limit (`returnOverflow`, `_lib/__tests__/db/restoreOverflow.test.ts`). Worth building in Bela too; once Bela has it, take Bela's |

Bela's migrations `20261026120000_tournaments`, `20261030120000_turniri_v1`, `20261031120000_tournament_auto_publish`,
`20261107120000_organizer_role`, `20261107180000_open_signups`, `20261107190000_open_signups_check` and
`20261107200000_round_game_minutes` are Treseta's `20261110120000_tournaments`, `20261110120100_game_time` and
`20261110120200_bans_and_organizer`: the same shape by different SQL, since Treseta never had Bela's old unused
`Tournament` tables and creates them instead of altering them.

Still out, for now:

- **Otključaj partiju** (Bela's `e63ea99`, `b9f1a91`, `880baac`, DECISIONS #89): `_ui/admin/UnlockTable.tsx`,
  `_lib/service/admin/unlock.ts`, `api/admin/tables/[roundId]/unlock/`, `TablePad`'s `lock` and `gameMinutes`, and
  `_lib/__tests__/db/unlock.test.ts`. It is Bela's own work from after the sync point, not part of the tournaments as
  they stood: the nightly sync brings it like any other Bela change. `Round.game_minutes` is already here, and
  `gameMinutesOf` already reads the table's minutes before its tournament's and its league's.
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
| `_lib/service/league/arrival.ts`, `_interfaces/leagueArrival.ts`, `_lib/__tests__/leagueArrival.test.ts` | `last_round` (no Tu smo after the night's last round) came without `ban` |
| `_lib/service/admin/tables.ts` | `lockLeague` is the advisory lock itself (Bela: through `lockCompetition`), and `deleteNightTables` settles by the league's id |

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
| 11 Oct 2026 | up to `4bf68ad` | The transition ([TRANSITION_PLAN.md](TRANSITION_PLAN.md)) |
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
| 11 Nov 2026 | none (Treseta's own) | **Zvanja** (ZVANJA_PLAN.md, branch `zvanja`): 3 and 4 per team per hand, Bela's Zvanja step and admin steps with Treseta's values and check, and Bela's tournament switch `declarations` brought back. The files above lose their "without zvanja" difference; Bela's `_lib/bela/declarations.ts` isn't copied |
| 7 Nov 2026 | `92df912..a0686e1` (42) | Run by hand after the nightly stop at `3b85bfa`: Gost i poziv decided not copied for now. 19 came over (6 adapted by hand): Registracija s Googleom (without `?next=`), Datumi (Uredi večer moves a night, Obriši večer i kola, Dodaj večer, the phone sheet), Okupljanje (1 migration, `20261101120000_league_gathering_time`, Bela's SQL), Nađi zamjenu until Tu smo opens, Dnevni poredak lists arrived teams, Odlazimo and Ipak otkazujemo as buttons and under Započni igru (`LeaveParts.tsx`), the round-close tests and the finished-match guard on Treseta's hands, Natrag na kolo after a reload, Igrači A–Ž / Najnoviji, the sign-up checks and limit, no Tu smo after the last round, the phone's Back closing sheets, the bold Tu smo note. 23 skipped: Gost i poziv (4), tournaments (14; the Burza test part of `726b292` came separately), Vrijeme partije, `CHANGELOG.md` (2), `CLAUDE.md`, and `699984e` (its look came with `LeaveRow`) |
| 8 Nov 2026 | `a0686e1..88425c3` (9 of 22) | Stopped at `28d19f2` (Organizator: a tournament role on a new role→capability foundation across about 80 shared files, with a migration; not decided). 4 came over: the admin's no-winner warning (Meč ostaje bez pobjednika?, Spremi / Obriši svejedno) on Treseta's `winner_side` and hands, Raspored scrolling on Android (twice; Bela's mistaken revert of the warning left out), Vidljivost slike behind the photo. 5 skipped: `CHANGELOG.md` (4) and Bela's restore `ba7fb02` (already here); no migration |
| 11 Nov 2026 | `a0686e1..88425c3` (merged) | The four commits the 8 Nov run left on `bela-sync` were rebased onto the tournaments and merged into `master`. Five conflicts, each resolved by keeping both sides: the no-winner warning keeps the organizer's `refuseUnlessMyHand` and takes Bela's `allow_no_winner`, Vidljivost slike keeps the `team.moderate` guard, and the sync state took `88425c3`. The Organizator question the run parked is answered: the tournaments brought the whole role→capability foundation on 10 Nov. Unit tests (552), `tsc`, ESLint and `next build` pass; the `db/` tests were not run, since the repo's generated Prisma client belongs to the `zvanja` branch being built in parallel |
