# Syncing with the Bela app

The Bela app (`../Bela-Treseta-Tournamnet-app`) is primary: design, features and fixes are built there once and come
here every night. Only the differences listed under [Differences from Bela](#differences-from-bela) stay Treseta's
own; everything else is kept identical to Bela.

## Sync state

| | |
|---|---|
| Bela branch | `development`, read through the remote `bela` (the local Bela repo). Only commits come over, never Bela's uncommitted work |
| Last synced Bela commit | `4bf68ad` (8 Oct 2026) |
| Target branch | `feat/scorepad` until it is merged into `master`, then `master` |
| Sync branch | `bela-sync`, in the worktree `.claude/worktrees/bela-sync` |

The nightly sync moves the last synced commit forward. The other rows are built into the scheduled task: change the
task along with them.

## How the nightly sync works

At 04:00 the Claude desktop app runs the scheduled task **Bela → Treseta sync** (`bela-nightly-sync`; its prompt is
`~/.claude/scheduled-tasks/bela-nightly-sync/SKILL.md`). It runs while the app is open; a run missed because the app
was closed or the Mac was asleep starts when it is back. To run it now: Scheduled → Bela → Treseta sync → Run now.

1. Puts `bela-sync` on top of the target branch, in its own worktree, so your checkout and branch are never touched.
2. Takes each new commit on Bela's `development`, oldest first, with `git cherry-pick -x`. A change to a shared file
   comes over as it is; a change to one of the differences below is handled as its kind says.
3. Stops at the first commit it can't bring over with confidence, keeps the ones before it, and says why.
4. Checks the result: unit tests, ESLint, `tsc` (no new errors), `next build`, and the migration SQL against the schema.
5. Records the Bela commit it reached (above, and in the [log](#sync-log)), and reports every file that differs from
   Bela without being listed below (drift).

It never commits to the target branch or `master`, never pushes, never changes the Bela repo, and never connects to a
database.

**In the morning,** read the run's report in the app, then on the target branch (`master` after the cutover):

```bash
git log --oneline feat/scorepad..bela-sync
git merge --ff-only bela-sync
```

`bela-sync` is checked out in the worktree, so don't check it out in your own checkout: open the worktree folder or
use `git log` / `git diff` to look at it.

**A night that brings a migration** reports it untested, since the run has no database. Before it reaches `master`
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

| Treseta | Bela counterpart | What it holds |
|---|---|---|
| `_lib/game/scoring.ts` (Treseta only) | `_lib/bela/scoring.ts` | `HAND_POINTS = 11`, `CUSTOM_HAND_MAX = 99`, `MATCH_THRESHOLD = 41`, `BYE_MATCH_POINTS = 5`, `handError`, `matchWinner`. Pure, unit tested |
| `_lib/validation/validateResult.ts` | same path | `normalizeHand` checks a hand; `InvalidResultError` stays Bela's, since shared services import it |
| `_interfaces/result.ts`, `_interfaces/side.ts` (Treseta only) | `_interfaces/belaResult.ts`, `_interfaces/belaPlayerAnnouncement.ts` | A hand is `team1_game_points`, `team2_game_points`, `custom`; `TeamSide` |
| `_interfaces/match.ts`, `_interfaces/adminHand.ts` | same paths | Bela's export names (`AdminHandValidation`, `PadHand`, …) on Treseta's hands, so shared code reads them unchanged |
| `_lib/helpers/databaseHelpers.ts` | same path | Copies a finished match and its hands from `OngoingMatch`/`OngoingResult` to `Match`/`Result` |
| `_lib/service/ongoingResult/*` (Treseta only) | `_lib/service/ongoingBelaResult/*` | Saves and edits a hand with Bela's row locks; refuses a hand once the match is over |
| `_lib/service/ongoingMatch/getOneWithResults.ts`, `_lib/service/ongoingMatch/getRoundId.ts`, `_lib/service/match/finishOngoingMatch.ts`, `_lib/service/admin/hands.ts` | same paths | Bela's logic on Treseta's hand tables |
| `_store/game/resultStore.ts` (Treseta only) | `_store/bela/resultStore.ts`, `_store/bela/announcementStore.ts` | The keypad: the 11-split and Custom |
| `_fetchers/ongoingResult/*`, `api/ongoing-result/*` (Treseta only) | `_fetchers/ongoingBelaResult/*`, `api/ongoing-bela-result/*` | Fetchers and routes for a hand |
| `ongoing-match/[matchId]/ongoing-result/layout.tsx`, `…/ui/WizardHeader.tsx`, `…/ui/pages/ScorePage.tsx` | same paths, plus the trump-caller and announcement steps | Hand entry in one step: the team boxes and the keypad with Custom where Bela has Štiglja. The `new/score` and `[resultId]/score` pages are shared |
| `ongoing-match/ui/handFlow.ts`, `ongoing-match/ui/HandEntryPanel.tsx`, `ongoing-match/[matchId]/page.tsx` | same paths | The desktop entry panel and the hand rows, without "Tko je zvao" and zvanja |
| `_lib/ui/adminEntry.ts`, `league/[leagueId]/daily-standings/table/AdminEntryPanel.tsx` | same paths | The admin scorepad: Normal and Custom, where Bela has "Ručni unos" |
| `_bootstrap/refreshUser.ts`, `_utils/resetStores.ts` | same paths | No announcement store |
| `_lib/__tests__/`: `scoring`, `serverHand`, `handEntryStores`, `scoreboardMatch`, `adminEntry` tests, `helpers/handEntry.ts` | same names | Tests of Treseta's rules |

### Shared files with a small edit

| File | Treseta's edit |
|---|---|
| `_hooks/useStartGame.ts`, `round/lineup/[roundId]/page.tsx`, `league/[leagueId]/daily-standings/table/[roundId]/page.tsx` | `1001` → `MATCH_THRESHOLD` (the table page's comment says "Custom" for "Ručni unos") |
| `_lib/service/round/insertPairRounds.ts` | Bye matches `BYE_MATCH_POINTS : 0` (Bela: `301 : 0`), threshold `MATCH_THRESHOLD` |
| `ongoing-match/ui/useMatchSides.ts` | Imports `TeamSide` from `_interfaces/side` |
| `_store/ongoingMatchStore.ts` | The hands field is `results` (Bela: `belaResults`) |
| `_lib/service/league/getStandings.ts` | No `tournament_id: null`: Treseta has no tournament tables |
| `_lib/service/admin/recalc.ts` | `RATINGS_FROM` = 1 Aug 2025, so the whole Treseta history is rated (Bela: 7 Oct 2025) |
| `_lib/rating/glicko2.ts` | One comment: "for teams of two" (Bela: "for Bela teams of two") |
| `next.config.mjs` (root) | Redirects the old `/match/:id` to `/` |
| `package.json`, `package-lock.json` (root) | The name `treseta-tournament-app`. On a lock file conflict, take Bela's lock file and put the two names back |
| `.gitignore` (root) | Also ignores `.env`, `/backups/` and `.claude/worktrees/` |

### Branding

| File | Treseta's |
|---|---|
| `_lib/brand.ts` (Treseta only) | "Trešeta Liga" and its accusative, no line above the name (Bela: "Piatnik"), the icon letters "TL" |
| `layout.tsx`, `_ui/auth/AuthFrame.tsx`, `_ui/sp/DesktopShell.tsx`, `_ui/install/InstallSheet.tsx`, `_hooks/useLeagues.ts` | Bela's "Bela Liga", "Piatnik Bela Liga", "Piatnik" and "BL" read from `BRAND` |
| `public/manifest.webmanifest` (root) | `name`, `short_name`, `description` |
| `public/icons/*` (root) | The "TL" icons, drawn like Bela's "BL" |

New Bela text with the app's name or the sponsor uses `BRAND` here, and its file joins this table.

### Conferences

A league can split its teams into conferences, each with a name and a color. The color is a dot before the team's
name, and Daily's night table and League standings get a view per conference. Create Round warns about a table with two
teams of one conference. Bela doesn't have conferences for now. The plan and decisions are in
[CONFERENCES_PLAN.md](CONFERENCES_PLAN.md).

New files (Treseta only):

| Treseta | What it holds |
|---|---|
| `_lib/conferences.ts` | The palette, the rules for a league's list (none or 2–6, names and colors unique), the lookup the screens use, the same-conference pairs for Create Round, and "Distribute evenly". Pure, unit tested in `_lib/__tests__/conferences.test.ts` |
| `_lib/service/league/conferences.ts`, `api/leagues/[id]/conferences/route.ts`, `api/leagues/[id]/conferences/teams/route.ts`, `_fetchers/league/conferences.ts` | Reading a league's conferences (public) and saving them and the teams' conferences (admin) |
| `_hooks/useConferences.ts`, `_hooks/useConferenceFilter.ts` | A league's conferences for the screens, and the conference picked on Daily and League standings |
| `_ui/sp/TeamDot.tsx` | The dot before a team's name, taken from the Start Game card |
| `_ui/league/ConferenceEditor.tsx`, `_ui/league/ConferenceFilter.tsx`, `league/[leagueId]/manage/ConferencesCard.tsx`, `league/[leagueId]/manage/ConferenceParts.tsx` | The editor, the filter chips, and Manage League's conference cards and team picker |

Shared files with Treseta's conference code. A Bela change to one of them is merged around that code, as for a small
edit:

| File | Treseta's edit |
|---|---|
| `_interfaces/league.ts`, `_lib/service/league/leagues.ts`, `_fetchers/league/leagues.ts`, `_hooks/useLeagueTeams.ts`, `api/leagues/[id]/teams/[teamId]/route.ts` | Create League takes conferences; a league's team list has each team's `conference_id`, and the team PATCH sets it |
| `_interfaces/round.ts`, `api/rounds/generate-multiple/route.ts`, `_fetchers/round/createMultipleRounds.ts`, `_ui/round/CreateRound.tsx`, `createRound/page.tsx` | Create Round: the same-conference tables come back in the same 409 as the repeats (`PAIRING_NOTICE`, `allowSameConference`), the notice lists both, and the team list has the dots |
| `api/rounds/open/route.ts`, `_fetchers/round/getOpenByPlayerId.ts`, `_hooks/useOpenTable.ts`, `_ui/home/PhoneHome.tsx` | The Start Game card shows the two teams' conference colors (green and red in a league without conferences) |
| `_lib/ui/standings.ts`, `_lib/ui/tables.ts`, `_ui/sp/Standings.tsx`, `_ui/sp/Controls.tsx`, `_ui/sp/index.ts` | Standings and table rows carry each team's conference, the standings draw its dot, a tab item can have a dot, and the kit exports `TeamDot` |
| `league/[leagueId]/daily-standings/page.tsx`, `league/[leagueId]/daily-standings/ui/RoundTables.tsx`, `league/[leagueId]/standings/page.tsx`, `_ui/home/DesktopHome.tsx`, `round/pairings/[roundNumber]/page.tsx` | The dots, and the conference filter on Daily's night table and League standings |
| `league/new/page.tsx`, `league/[leagueId]/manage/page.tsx`, `league/[leagueId]/manage/LeagueDetailsView.tsx` | Create League's Conferences switch; Manage League's team picker, filter and cards (Details shows the conferences card in its second column) |

The database part (the `Conference` table and `LeagueTeam.conference_id`) is under Database.

### Database

| Path (root) | Kind | Treseta's |
|---|---|---|
| `prisma/schema.prisma` | Own version | Bela's schema with Treseta's hand tables (`Result`, `OngoingResult`: `team1_game_points`, `team2_game_points`, `custom`) and without Bela's tournament and announcement tables. Bela's changes to the other models are merged in. The datasource also has `directUrl = env("DATABASE_URL_UNPOOLED")`, so migrations use Neon's direct connection (Bela has only `url`). Treseta also has the `Conference` table and `LeagueTeam.conference_id` (see Conferences) |
| `prisma/migrations/**` | Treseta only | This database's history. Bela's migrations are never copied: a Bela schema change gets a Treseta migration with Bela's SQL adapted to this schema, named with a timestamp after the newest migration here. Bela's names can collide with Treseta's (its work in progress uses `20261011120000`, which Treseta already has) |
| `prisma/seed.ts` | Own version | The Treseta seed (users `admin` and `player`, a league of 8 teams in two conferences). Seed data for new Bela tables is added here |
| `prisma/usefulQueries/**` | Own version | Treseta's queries, with `transition_checks.sql`. Bela's aren't copied |

### Repository files

| Path (root) | Kind |
|---|---|
| `README.md`, `ProcessFlow.md`, `Task.md`, `.windsurfrules` | Own version |
| `BELA_SYNC.md`, `TRANSITION_PLAN.md`, `CONFERENCES_PLAN.md`, `.env.example` | Treseta only |
| `vercel.json` | Treseta only for now: the same file as Bela's `9ecdaae`, which is on Bela's GitHub `master` but not yet on `development`. Shared once it reaches `development` |
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

1. Make the change on the target branch, as small as it can be: a constant in `_lib/game/scoring.ts` or a field in
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
