# Syncing with the Bela app

The Bela app (`../Bela-Treseta-Tournamnet-app`) is primary: design, features and fixes are built there once and come
here every night. Only the differences listed under [Differences from Bela](#differences-from-bela) stay Treseta's
own; everything else is kept identical to Bela.

## Sync state

| | |
|---|---|
| Bela branch | `development`, read through the remote `bela` (the local Bela repo). Only commits come over, never Bela's uncommitted work |
| Last synced Bela commit | `4bf68ad` (8 Oct 2026) |
| Waiting in Bela | 40 commits up to `1ea2748` (13 Oct 2026), settled under [Bela's work waiting to come over](#belas-work-waiting-to-come-over) |
| Target branch | `master` |
| Sync branch | `bela-sync`, in the worktree `.claude/worktrees/bela-sync` |

The nightly sync moves the last synced commit forward. The other rows are built into the scheduled task: change the
task along with them.

## How the nightly sync works

Every morning at about 06:00 (cron `0 6 * * *`, plus a few minutes of jitter) the Claude desktop app runs the
scheduled task **Bela → Treseta sync** (`bela-nightly-sync`; its prompt is
`~/.claude/scheduled-tasks/bela-nightly-sync/SKILL.md`). It runs while the app is open; a run missed because the app
was closed or the Mac was asleep starts when it is back. To run it now: Scheduled → Bela → Treseta sync → Run now.

The task has to start in the Treseta repo itself, not in a worktree of its own, and in a permission mode that doesn't
wait for approvals: the sandbox lets a run write only inside the folder it started in, and nobody is there to approve
anything. Both are the task's settings in the app's Scheduled screen. The run of 13 Oct started in its own worktree
(`.claude/worktrees/jovial-sutherland-f6018a`), every write to `.claude/worktrees/bela-sync` was refused, and nothing
came over.

1. Puts `bela-sync` on top of the target branch, in its own worktree, so your checkout and branch are never touched.
2. Takes each new commit on Bela's `development`, oldest first, with `git cherry-pick -x`. A change to a shared file
   comes over as it is; a change to one of the differences below is handled as its kind says, and the commits under
   [Bela's work waiting to come over](#belas-work-waiting-to-come-over) as that section decides.
3. Stops at the first commit it can't bring over with confidence, keeps the ones before it, and says why.
4. Checks the result: unit tests, ESLint, `tsc` (no new errors), `next build`, and the migration SQL against the schema.
5. Records the Bela commit it reached (above, and in the [log](#sync-log)), and reports every file that differs from
   Bela without being listed below (drift).

It never commits to the target branch or `master`, never pushes, never changes the Bela repo, and never connects to a
database.

**In the morning,** read the run's report in the app, then on `master`:

```bash
git log --oneline master..bela-sync
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

## Bela's work waiting to come over

Bela's `development` has 40 commits after `4bf68ad`, up to `1ea2748` (13 Oct 2026). All of it comes to Treseta: league
nights with start times and Raspored, Burza igrača, smokers and smoking tables, deactivated and deleted players, the
Team and Player pages with the admin's Ekipe and Igrači (Manage Team is gone), every screen and message in Croatian,
every colour from the design tokens, Croatian 404 and error pages, and Rejting 50 players at a time. This section
settles where those commits meet Treseta's differences. Once they are on `master` it goes, and what lasts moves to
Differences.

Conferences stay exactly as they are (see [Conferences](#conferences)): every Bela change is merged around them, and
the changes below to conference code are only the mechanical ones Bela's commits force (token names, where the palette
lives, the error class). A Bela change that can't come over without changing what conferences do, look like or say
stops the sync at that commit.

### Migrations

All six come over with Bela's SQL: the tables they touch (`Player`, `League`, `Round`, `RoundPlayer`, `LeagueRound`,
`Team`) are the same in both schemas. Only the first is renamed, since Treseta already has
`20261011120000_match_like_bela`:

| Bela | Treseta |
|---|---|
| `20261011120000_league_nights_burza` | `20261011233000_league_nights_burza` |
| `20261012120000_smokers`, `20261012130000_player_active`, `20261012140000_round_player_team_key`, `20261013120000_burza_with_player`, `20261013150000_night_start_time` | the same names |

Their data steps fit Treseta's data (checked on 13 Oct 2026): the nights backfill gives IV. Trešeta Liga 26/27 its
Wednesdays from 14 Oct 2026 to 7 Apr 2027 (`play_day` 2) and III. Sezona Treseta Lige the dates of its rounds, and
`RoundPlayer`'s new key (round, team, player) contains the old one. `schema.prisma` takes Bela's model changes around
Treseta's own parts. As for every migration, test them on a copy of production before they reach `master`.

The seed (own version) gives its league nights the way Bela's seed does: 16 weekly nights from five weeks before the
last play day, with the start and end dates taken from them, on the league's Thursday (`play_day` 3).

### Design tokens (`de9ef11`)

Bela's new test `_lib/__tests__/tokens.test.ts` fails on any hex, `rgb()` or `hsl()` value in `src/app` outside
`_styles/`, and `_styles/tokens.ts` drops some names. The renames, as Bela made them:

| Old | New |
|---|---|
| `color.card` | `color.white` |
| `color.inkSoft` | `color.ink2` |
| `color.tableHead`, `color.paperSoft` | `color.paper2` |
| `color.paperDeep`, `color.pressed` | `color.lineFill` |
| `color.placeholder` | `color.faint` |
| `color.live` | `color.red` |
| `color.mine`, `color.creamSoft` | `color.cream2` |
| `color.lineStrong` | `tint.navy[12]` |
| `color.hover` | `tint.navy[8]` |
| `color.switchOff` | `tint.navy[20]` (`color.borderControl`) |
| `color.scrim` | `tint.scrim[32]` or `tint.scrim[42]`, as Bela picks for the backdrop |
| `color.medalRow` | `color.medalBg` |

Treseta's own colour values become tints: `rgba(60,74,103,.25)` → `tint.navy[25]`, `rgba(188,71,73,.35)` →
`tint.red[35]`, `rgba(188,71,73,.07)` → `tint.red[6]`, `rgba(255,255,255,.6)` → `tint.white[62]`, `#FFFFFF` →
`color.white`. The conference palette moves, with the same six colors and names, from `_lib/conferences.ts` to a new
Treseta-only `_styles/conferences.ts` (the test skips `_styles/`), which `_lib/conferences.ts` imports. Every
conference screen looks as it does now. Files to change: `_lib/conferences.ts`,
`_ui/sp/TeamDot.tsx`, `_ui/league/ConferenceEditor.tsx`, `league/[leagueId]/manage/ConferenceParts.tsx` and
`league/[leagueId]/manage/ConferencesCard.tsx`. The game-rule files take Bela's token changes like any design change.
Treseta's edits inside shared files have no colour values.

### Croatian (`6829f76`, `d9c2aca`, `e1c404c`, `8b687f5`)

Shared screens and messages come over in Croatian. Treseta's own wording is Croatian already (13 Oct 2026): the
conference screens and messages, the "Samo unutar konferencija" switch, the hand-entry messages (in Bela's words,
"Igra ne postoji.", "Ovaj meč je već završen.") and Custom, which is "Ručno" on the keypad and "Ručni unos" in hints
and on the admin scorepad, as in Bela. The sync keeps that wording as it is. The game-rule files take Bela's other
wording changes for what they share with Bela; its sentences about zvanja, štiglja and the trump caller stay out,
`0ab49f8`'s `CALLER_MISSING` too.

### Create Round (`d895a53`, `f5b3d0f`, `8b687f5`, `6829f76`)

- Round creation goes in this order: pairing, the repeats check, then seating. Pairing is where conferences act: with
  `withinConferences` in a league with conferences it is `generateGroupedRoundPairings(conferenceGroups(…))`, so every
  table has two teams of one conference, otherwise Bela's `generateMultipleRoundPairings` call. Smoking comes last:
  Bela's `seatRounds` only decides which pair sits at which table, from the smokers and the smoking tables, and never
  changes who plays whom, so the conference pairs stay together. It already handles several byes in a round (one per
  conference with an odd count). `insertRoundBatch` follows as Bela has it.
- Bela's pairing throws `InvalidResultError` for impossible settings, and the route no longer catches it (a 400
  through `errorResponse`). `generateGroupedRoundPairings` throws `InvalidResultError` too, with its sentence ("{name}
  večeras ima {n} ekipe, premalo za {k} kola unutar konferencije.") and the group name "Ekipe bez konferencije" as
  they are, so a conference with too few teams stays a 400 and not a 500.
- The request has both `smoking_tables` and `withinConferences`. `createMultipleRoundsAPI` takes Bela's
  `smokingTables` after `allowRepeats`, then Treseta's `withinConferences`. The switch stays under Rounds and Window,
  next to Bela's smoking tables.

### Standings and tables (`617c83b`)

`toStandingsRows` takes Bela's options object (`{myTeamNames, highlightTeamId}`); Treseta's `conferenceOf` becomes a
field of it, and its callers and `conferences.test.ts` follow. `toTableRows` keeps Treseta's third parameter.

### Manage League and Create League (`48cb3dd`, `7084838`, `d43e0c2`, `7bbfae2`, `1ea2748`)

- Manage League is Bela's page (the Datumi view, a desktop-only note on the phone, no `LeagueNameCard`, Create team to
  `/teams?new=1&league=<id>`) with Treseta's conference parts as they are: the conference filter, the picker under each
  team's name, the Distribute card in the side panel, and `ConferencesCard` as `LeagueDetailsView`'s `aside` (Bela's
  Details still leaves the second column empty). Treseta's phone placements of the conference cards go with Bela's
  phone layout.
- Create League is Bela's (nights, start time, optional play day) with Treseta's Conferences switch and editor.
  `LeagueCreateRequestValidation` has Bela's night fields and `conferences`; `createLeague` creates the nights and the
  conferences in the one nested create; `listLeagueTeams` returns Bela's `smokers` and Treseta's `conference_id`, and
  `useLeagueTeams` keeps both.

### Branding and the hand-entry counterparts

- Bela's new text with "Piatnik Bela Liga" reads `BRAND.name`, as `layout.tsx` does: `_ui/profiles/PageParts.tsx`
  (the `DesktopShell` eyebrow), `_ui/sp/PageMessage.tsx` (the page title) and `global-error.tsx` (the title). They join
  the Branding table. `_lib/navStack.ts`'s storage key `bela.navStack` stays Bela's: the apps have separate origins.
- Carried into Treseta's counterparts: the 404 for a malformed id (`isDbId`, `12b185d`) in
  `api/ongoing-result/[id]/route.ts`, and `6829f76`'s `apiFetch` / `responseErrorMessage` in `_fetchers/ongoingResult/*`
  (their Croatian messages are already there).
  Treseta's `_fetchers/league/conferences.ts` moves to `apiFetch` too (its messages unchanged), so a 401 there starts
  the session check as everywhere else.
- Not copied, under the rules below: `DECISIONS.md`, `prisma/usefulQueries/burzaTestData.sql` (it names Bela's teams)
  and `prisma/seedHelpers.ts`.

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
| `_lib/conferences.ts` | The palette, the rules for a league's list (none or 2–6, names and colors unique), the lookup the screens use, tonight's teams by conference for Create Round, and "Distribute evenly". Pure, unit tested in `_lib/__tests__/conferences.test.ts` |
| `_lib/service/league/conferences.ts`, `api/leagues/[id]/conferences/route.ts`, `api/leagues/[id]/conferences/teams/route.ts`, `_fetchers/league/conferences.ts` | Reading a league's conferences (public) and saving them and the teams' conferences (admin) |
| `_hooks/useConferences.ts`, `_hooks/useConferenceFilter.ts` | A league's conferences for the screens, and the conference picked on Daily and League standings |
| `_ui/sp/TeamDot.tsx` | The dot before a team's name, taken from the Start Game card |
| `_ui/league/ConferenceEditor.tsx`, `_ui/league/ConferenceFilter.tsx`, `league/[leagueId]/manage/ConferencesCard.tsx`, `league/[leagueId]/manage/ConferenceParts.tsx` | The editor, the filter chips, and Manage League's conference cards and team picker |

Shared files with Treseta's conference code. A Bela change to one of them is merged around that code, as for a small
edit:

| File | Treseta's edit |
|---|---|
| `_interfaces/league.ts`, `_lib/service/league/leagues.ts`, `_fetchers/league/leagues.ts`, `_hooks/useLeagueTeams.ts`, `api/leagues/[id]/teams/[teamId]/route.ts` | Create League takes conferences; a league's team list has each team's `conference_id`, and the team PATCH sets it |
| `_interfaces/round.ts`, `api/rounds/generate-multiple/route.ts`, `_fetchers/round/createMultipleRounds.ts`, `_ui/round/CreateRound.tsx`, `createRound/page.tsx` | Create Round: the "Only within conferences" switch (`withinConferences`) and the team list's dots |
| `_lib/matching/multipleRoundMatching.ts` | `generateGroupedRoundPairings` at the end of the file, which pairs every conference on its own with the unchanged pairing |
| `api/rounds/open/route.ts`, `_fetchers/round/getOpenByPlayerId.ts`, `_hooks/useOpenTable.ts`, `_ui/home/PhoneHome.tsx` | The Start Game card shows the two teams' conference colors (green and red in a league without conferences) |
| `_lib/ui/standings.ts`, `_lib/ui/tables.ts`, `_ui/sp/Standings.tsx`, `_ui/sp/Controls.tsx`, `_ui/sp/index.ts` | Standings and table rows carry each team's conference, the standings draw its dot, a tab item can have a dot, and the kit exports `TeamDot` |
| `league/[leagueId]/daily-standings/page.tsx`, `league/[leagueId]/daily-standings/ui/RoundTables.tsx`, `league/[leagueId]/standings/page.tsx`, `_ui/home/DesktopHome.tsx`, `round/pairings/[roundNumber]/page.tsx` | The dots, and the conference filter on Daily's night table and League standings |
| `league/new/page.tsx`, `league/[leagueId]/manage/page.tsx`, `league/[leagueId]/manage/LeagueDetailsView.tsx` | Create League's Conferences switch; Manage League's team picker, filter and cards (Details shows the conferences card in its second column) |

The database part (the `Conference` table and `LeagueTeam.conference_id`) is under Database.

### Database

| Path (root) | Kind | Treseta's |
|---|---|---|
| `prisma/schema.prisma` | Own version | Bela's schema with Treseta's hand tables (`Result`, `OngoingResult`: `team1_game_points`, `team2_game_points`, `custom`) and without Bela's tournament and announcement tables. Bela's changes to the other models are merged in. The datasource also has `directUrl = env("DATABASE_URL_UNPOOLED")`, so migrations use Neon's direct connection (Bela has only `url`). Treseta also has the `Conference` table and `LeagueTeam.conference_id` (see Conferences) |
| `prisma/migrations/**` | Treseta only | This database's history. Bela's migrations are never copied: a Bela schema change gets a Treseta migration with Bela's SQL adapted to this schema, named with a timestamp after the newest migration here. Bela's names can collide with Treseta's: Bela's `20261011120000_league_nights_burza` has the timestamp of Treseta's `20261011120000_match_like_bela` (see [Migrations](#migrations)) |
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
| 13 Oct 2026 | none | Stopped before the first commit: the run started in its own worktree and couldn't write to `.claude/worktrees/bela-sync` |
