# Syncing with the Bela app

The Bela app (`../Bela-Treseta-Tournamnet-app`) is primary: design, features and fixes are built there once and come
here every night. Only the differences listed under [Differences from Bela](#differences-from-bela) stay Treseta's
own; everything else is kept identical to Bela.

## Sync state

| | |
|---|---|
| Bela branch | `development`, read through the remote `bela` (the local Bela repo). Only commits come over, never Bela's uncommitted work |
| Last synced Bela commit | `91f1537` (16 Oct 2026) |
| Waiting in Bela | Nothing settled ahead (see [Bela's work waiting to come over](#belas-work-waiting-to-come-over)) |
| Target branch | `master` |
| Sync branch | `bela-sync` in the repo itself (no worktree): created from `master`, or rebased onto it, by every run |

The nightly sync moves the last synced commit forward. The other rows are built into the scheduled task: change the
task along with them.

## How the nightly sync works

Every morning at about 06:00 (cron `0 6 * * *`, plus a few minutes of jitter) the Claude desktop app runs the
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

Nothing: every Bela commit up to `91f1537` (16 Oct 2026) came over by 17 Oct 2026, and what lasts from the decisions
settled for them is under Differences. Decisions for Bela work that touches Treseta's differences before it comes
over go here.

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

| Treseta | Bela counterpart | What it holds |
|---|---|---|
| `_lib/game/scoring.ts` (Treseta only) | `_lib/bela/scoring.ts` | `HAND_POINTS = 11`, `CUSTOM_HAND_MAX = 99`, `MATCH_THRESHOLD = 41`, `TARGET_RAISE = 10`, `BYE_MATCH_POINTS = 5`, `handError`, `matchWinner`, `matchState` (the hands replayed: target, winner, "s ovim dosta"), `dostaCallers`, `ratedMatch`. Pure, unit tested |
| `_lib/validation/validateResult.ts` | same path | `normalizeHand` checks a hand; `InvalidResultError` stays Bela's, since shared services import it |
| `_interfaces/result.ts`, `_interfaces/side.ts` (Treseta only) | `_interfaces/belaResult.ts`, `_interfaces/belaPlayerAnnouncement.ts` | A hand is `team1_game_points`, `team2_game_points`, `custom`; `TeamSide` |
| `_interfaces/match.ts`, `_interfaces/adminHand.ts` | same paths | Bela's export names (`AdminHandValidation`, `PadHand`, …) on Treseta's hands, so shared code reads them unchanged |
| `_lib/helpers/databaseHelpers.ts` | same path | Copies a finished match and its hands from `OngoingMatch`/`OngoingResult` to `Match`/`Result` |
| `_lib/service/ongoingResult/*` (Treseta only) | `_lib/service/ongoingBelaResult/*` | Saves and edits a hand with Bela's row locks; refuses a hand once the match is over, and a "s ovim dosta" call that can't stand (`matchState.ts`) |
| `_lib/service/ongoingMatch/getOneWithResults.ts`, `_lib/service/ongoingMatch/getRoundId.ts`, `_lib/service/match/finishOngoingMatch.ts`, `_lib/service/admin/hands.ts` | same paths | Bela's logic on Treseta's hand tables |
| `_store/game/resultStore.ts` (Treseta only) | `_store/bela/resultStore.ts`, `_store/bela/announcementStore.ts` | The keypad: the 11-split and Custom |
| `_fetchers/ongoingResult/*`, `api/ongoing-result/*` (Treseta only) | `_fetchers/ongoingBelaResult/*`, `api/ongoing-bela-result/*` | Fetchers and routes for a hand |
| `ongoing-match/[matchId]/ongoing-result/layout.tsx`, `…/ui/WizardHeader.tsx`, `…/ui/pages/ScorePage.tsx` | same paths, plus the trump-caller and announcement steps | Hand entry in one step: the team boxes and the keypad with Custom where Bela has Štiglja. The `new/score` and `[resultId]/score` pages are shared |
| `ongoing-match/ui/handFlow.ts`, `ongoing-match/ui/HandEntryPanel.tsx`, `ongoing-match/[matchId]/page.tsx` | same paths | The desktop entry panel and the hand rows, without "Tko je zvao" and zvanja; after a custom hand the scoreboard asks "Je li netko zvao „s ovim dosta”?", and a raised target shows as the "Do 51" flag |
| `ongoing-match/ui/MatchEnd.tsx` (Treseta only) | none | The "s ovim dosta" question (a bottom sheet) and the "Do 51" flag, used by the scoreboard and the admin scorepad |
| `_lib/ui/adminEntry.ts`, `league/[leagueId]/daily-standings/table/AdminEntryPanel.tsx` | same paths | The admin scorepad: Normal and Custom, where Bela has "Ručni unos"; Custom's hint names "s ovim dosta". `manualFields` (the phone's Custom sheet) takes 0 to `CUSTOM_HAND_MAX` (Bela: 0 to 9999) |
| `_ui/admin/TablePhone.tsx` | same path | The admin's phone scorepad on Bela's board and sheets: one keypad step (the 11-split) where Bela has the trump caller, zvanja and points; Custom (0 to 99, a custom hand) where Bela has Ručno and Ručni unos; after a custom hand the "s ovim dosta" question (`DostaPrompt`), and the "Do 51" flag on the board |
| `_bootstrap/refreshUser.ts`, `_utils/resetStores.ts` | same paths | No announcement store |
| `_lib/__tests__/`: `scoring`, `serverHand`, `handEntryStores`, `scoreboardMatch`, `adminEntry`, `tableOverview` tests, `helpers/handEntry.ts` | same names | Tests of Treseta's rules (`tableOverview`: Treseta's hands, 41 and Custom's 0–99) |

### Shared files with a small edit

| File | Treseta's edit |
|---|---|
| `_hooks/useStartGame.ts`, `round/lineup/[roundId]/page.tsx`, `league/[leagueId]/daily-standings/table/TablePreview.tsx` | `1001` → `MATCH_THRESHOLD` |
| `league/[leagueId]/daily-standings/table/[roundId]/page.tsx` | `1001` → `MATCH_THRESHOLD` (the comment says "Custom" for "Ručni unos"); after a custom hand `save` passes `run` an `after` that opens the "s ovim dosta" question (`DostaPrompt`, `askDosta` and `pickDosta`); the "Do 51" flag (`TargetFlag`) next to the admin pill; a match tab adds "· do 51" |
| `_lib/service/admin/recalc.ts`, `_lib/service/ratings/ratings.ts` | The ratings read each match's `winner_side` through `ratedMatch`, so a "s ovim dosta" win with fewer points is a win (Bela compares the points). `recalc.ts` also has `RATINGS_FROM`, below |
| `_lib/service/round/insertPairRounds.ts` | Bye matches `BYE_MATCH_POINTS : 0` (Bela: `301 : 0`), threshold `MATCH_THRESHOLD` |
| `ongoing-match/ui/useMatchSides.ts` | Imports `TeamSide` from `_interfaces/side` |
| `_store/ongoingMatchStore.ts` | The hands field is `results` (Bela: `belaResults`) |
| `_lib/service/league/getStandings.ts` | No `tournament_id: null`: Treseta has no tournament tables |
| `_lib/service/admin/recalc.ts` | `RATINGS_FROM` = 1 Aug 2025, so the whole Treseta history is rated (Bela: 7 Oct 2025) |
| `_lib/rating/glicko2.ts` | One comment: "for teams of two" (Bela: "for Bela teams of two") |
| `next.config.mjs` (root) | Redirects the old `/match/:id` to `/` |
| `package.json`, `package-lock.json` (root) | The name `treseta-tournament-app`, and `build` runs `node scripts/previewAdmin.js` after the migrations. On a lock file conflict, take Bela's lock file and put the two names back |
| `.gitignore` (root) | Also ignores `.env`, `/backups/` and `/.claude/` |

### Branding

| File | Treseta's |
|---|---|
| `_lib/brand.ts` (Treseta only) | "Trešeta Liga" and its accusative, no line above the name (Bela: "Piatnik"), the app icon's path (`icon`) and the transparent logo's (`logo`) |
| `layout.tsx`, `global-error.tsx`, `_ui/auth/AuthFrame.tsx`, `_ui/sp/DesktopShell.tsx`, `_ui/sp/PageMessage.tsx`, `_ui/profiles/PageParts.tsx`, `_ui/install/InstallSheet.tsx`, `_hooks/useLeagues.ts`, `league/[leagueId]/standings/page.tsx` (two comments) | Bela's "Bela Liga", "Piatnik Bela Liga", "Piatnik" and "BL" read from `BRAND` (the Brand block shows no eyebrow while `BRAND.eyebrow` is empty). The install sheet's `AppIcon` draws the logo from `BRAND.icon` where Bela draws "BL" on navy. `AuthFrame.tsx`'s `Brand` puts `BRAND.logo` before the name (login, sign-up, Početna): on login the name is set in two lines and the logo is as tall as both |
| `public/manifest.webmanifest` (root) | `name`, `short_name`, `description`, and the maskable icon `icon-maskable-512.png` |
| `public/icons/*`, `public/logo.png`, `src/app/favicon.ico`, `src/app/icon.png` (root) | Treseta's flower logo (blue and yellow petals in a black ring), not Bela's "BL": `icon-192.png` and `icon-512.png` on a transparent background, `icon-maskable-512.png` and `apple-touch-icon.png` on the cream `#F5F2EA`; `logo.png`, `favicon.ico` and `icon.png` (the browser tab's, which Next links with a version) transparent. A Bela change to its icons is dropped |

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
| `_interfaces/round.ts`, `api/rounds/generate-multiple/route.ts`, `_fetchers/round/createMultipleRounds.ts`, `_ui/round/CreateRound.tsx` | Create Round (desktop): the "Samo unutar konferencija" switch (`withinConferences`, under Rounds and Window, next to the smoking tables; the fetcher sends it after `smokingTables`) and the team list's dots. The switch is local state, off for every league, outside Bela's saved Novo kolo draft; `useCreateRound` also returns `hasConferences`, `withinConferences` and `setWithinConferences` for the phone. The route pairs (by conference when asked), checks repeats, then Bela's `seatRounds` only places the pairs at tables |
| `_ui/admin/CreateRoundPhone.tsx`, `_ui/admin/DraftPhone.tsx` | The admin's phone: Novo kolo has the "Samo unutar konferencija" switch under the window, and Skica kola the teams' dots |
| `_lib/matching/multipleRoundMatching.ts` | `generateGroupedRoundPairings` at the end of the file, which pairs every conference on its own with the unchanged pairing; a conference with too few teams throws `InvalidResultError` (a 400) |
| `api/rounds/open/route.ts`, `_fetchers/round/getOpenByPlayerId.ts`, `_hooks/useOpenTable.ts`, `_ui/home/PhoneHome.tsx` | The Start Game card shows the two teams' conference colors (green and red in a league without conferences) |
| `_lib/ui/standings.ts`, `_lib/ui/tables.ts`, `_ui/sp/Standings.tsx`, `_ui/sp/Controls.tsx`, `_ui/sp/index.ts`, `_lib/__tests__/conferences.test.ts` | Standings and table rows carry each team's conference (`conferenceOf` is a field of `toStandingsRows`' options; `toTableRows` has it as a third parameter), the standings draw its dot before the linked name, a tab item can have a dot, and the kit exports `TeamDot` |
| `league/[leagueId]/daily-standings/page.tsx`, `league/[leagueId]/daily-standings/ui/RoundTables.tsx`, `league/[leagueId]/standings/page.tsx`, `_ui/home/DesktopHome.tsx`, `league/[leagueId]/manage/DraftView.tsx` | The dots (also on Skica's tables, which replaced the pairings page), and the conference filter on Daily's night table and League standings. Ukupni poredak's +/− shows on the whole league's table only, not in a conference's view |
| `league/new/page.tsx`, `league/[leagueId]/manage/page.tsx`, `league/[leagueId]/manage/LeagueDetailsView.tsx` | Nova liga's Conferences switch and editor before Okupljanje (and their count in its summary); Upravljanje ligom's team picker, filter and Distribute card (Podaci shows the conferences card as its `aside`, under Okupljanje in the right column) |

The database part (the `Conference` table and `LeagueTeam.conference_id`) is under Database.

### Database

| Path (root) | Kind | Treseta's |
|---|---|---|
| `prisma/schema.prisma` | Own version | Bela's schema with Treseta's hand tables (`Result`, `OngoingResult`: `team1_game_points`, `team2_game_points`, `custom`, `dosta_side`) and `Match.winner_side` and without Bela's tournament and announcement tables. Bela's changes to the other models are merged in. The datasource also has `directUrl = env("DATABASE_URL_UNPOOLED")`, so migrations use Neon's direct connection (Bela has only `url`). Treseta also has the `Conference` table and `LeagueTeam.conference_id` (see Conferences) |
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

- `.env` (Bela tracks it; here it is ignored), `next-env.d.ts` (ignored here), `.idea/`, `bela-tournament-app.zip`,
  `tmp-file.ts`, `skills-lock.json`, `backups/`, `.claude/`.
- Bela's documents: `PLAN.md`, `DECISIONS.md`, `BACKEND_REVIEW.md`, `REFINEMENTS.md`, `TEST_REPORT.md`, `BLOCKERS.md`,
  `RATING_INTEGRATION.md`, and any other Markdown file Bela adds at its root.
- Bela's database files: `prisma/migrations/**` (see Database), `prisma/seedHelpers.ts`, `prisma/usefulQueries/**`.
- Bela's game: `_lib/bela/`, `_interfaces/belaResult.ts`, `_interfaces/belaPlayerAnnouncement.ts`, `_store/bela/`,
  `_fetchers/ongoingBelaResult/`, `_lib/service/ongoingBelaResult/`, `api/ongoing-bela-result/`, and the hand entry's
  trump-caller and announcement steps (`ongoing-match/[matchId]/ongoing-result/new/` and `…/[resultId]/`:
  `trump-caller/`, `announcement/`; `…/ui/pages/TrumpCallerPage.tsx`, `…/ui/pages/AnnouncementPage.tsx`). Their
  Treseta counterparts are under Game rules.
- Unused images: `public/TitleBackground.png`, `public/TitleBackgroundSponsors.png`, `public/background.png`,
  `public/title.png`.

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
